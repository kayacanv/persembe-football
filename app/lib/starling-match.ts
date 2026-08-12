// Shared Starling -> player matching logic. SERVER ONLY.
//
// Used by BOTH the real-time webhook (app/api/webhooks/starling/feed-item) and
// the cron backstop (app/api/cron/starling-sync). Idempotent: re-processing the
// same feed item never duplicates a row or re-marks a player.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { StarlingFeedItem } from "./starling-server"
import { normalizeRef, paymentRef } from "./payment-ref"
import { ACTIVE_PIGGY, isPiggyReference } from "@/app/config/piggy"

export type ProcessResult =
  | { status: "skipped"; reason: string; feedItemUid: string }
  | { status: "matched"; matchPlayerId: string; feedItemUid: string }
  | { status: "campaign"; campaign: string; feedItemUid: string }
  | { status: "unmatched"; reason: string; feedItemUid: string }

type UnpaidPlayerRow = {
  id: string
  match_id: string
  matches: { date: string; price: number } | { date: string; price: number }[] | null
  users: { name: string } | { name: string }[] | null
}

function matchOf(row: UnpaidPlayerRow): { date: string; price: number } | null {
  // Supabase returns the joined row as an object (to-one) but typings allow array.
  const m = Array.isArray(row.matches) ? row.matches[0] : row.matches
  return m ?? null
}

function nameOf(row: UnpaidPlayerRow): string {
  const u = Array.isArray(row.users) ? row.users[0] : row.users
  return u?.name ?? ""
}

// Record an incoming transfer as a kumbara (piggy bank) contribution and take the
// bank payment out of the admin "unmatched" queue. Idempotent via the unique
// (source, external_id) index, so webhook + cron redelivery can't double-count.
// The payer's name comes straight from the bank feed — there is nothing to type.
export async function recordPiggyContribution(
  supabase: SupabaseClient,
  item: StarlingFeedItem,
  campaignSlug: string = ACTIVE_PIGGY.slug,
): Promise<ProcessResult> {
  const feedItemUid = item.feedItemUid

  const { error: insertErr } = await supabase.from("piggy_contributions").upsert(
    {
      campaign: campaignSlug,
      source: "starling",
      external_id: feedItemUid,
      amount_minor: item.amount.minorUnits,
      currency: item.amount.currency,
      display_name: item.counterPartyName ?? null,
      paid_at: item.transactionTime,
    },
    { onConflict: "source,external_id", ignoreDuplicates: true },
  )

  if (insertErr) {
    return { status: "skipped", reason: `piggy insert failed: ${insertErr.message}`, feedItemUid }
  }

  await supabase
    .from("bank_payments")
    .update({ match_status: "campaign" })
    .eq("provider", "starling")
    .eq("feed_item_uid", feedItemUid)

  return { status: "campaign", campaign: campaignSlug, feedItemUid }
}

// Process a single incoming feed item. Only meaningful for IN/SETTLED items, but
// it stores everything passed for auditability.
export async function processFeedItem(
  supabase: SupabaseClient,
  item: StarlingFeedItem,
): Promise<ProcessResult> {
  const feedItemUid = item.feedItemUid

  // 1. Upsert the raw feed item. Only the immutable bank fields are written, so
  // re-delivery never clobbers an existing match_status / matched_match_player_id.
  const { error: upsertErr } = await supabase
    .from("bank_payments")
    .upsert(
      {
        provider: "starling",
        feed_item_uid: feedItemUid,
        amount_minor: item.amount.minorUnits,
        currency: item.amount.currency,
        direction: item.direction,
        reference: item.reference ?? null,
        counterparty_name: item.counterPartyName ?? null,
        transaction_time: item.transactionTime,
        raw: item as unknown as Record<string, unknown>,
      },
      { onConflict: "provider,feed_item_uid", ignoreDuplicates: false },
    )

  if (upsertErr) {
    return { status: "skipped", reason: `upsert failed: ${upsertErr.message}`, feedItemUid }
  }

  // 2. Read current state — bail if already matched (idempotency).
  const { data: existing } = await supabase
    .from("bank_payments")
    .select("id, match_status")
    .eq("provider", "starling")
    .eq("feed_item_uid", feedItemUid)
    .single()

  if (existing?.match_status === "matched" || existing?.match_status === "campaign") {
    return { status: "skipped", reason: `already ${existing.match_status}`, feedItemUid }
  }

  // Only auto-match settled incoming money.
  if (item.direction !== "IN") {
    return { status: "skipped", reason: "not incoming", feedItemUid }
  }

  // 3. Deterministic match: payer reference must contain a player's unique code
  // AND the amount must equal that match's price (in pence).
  const payerRef = normalizeRef(item.reference)
  if (!payerRef) {
    return { status: "unmatched", reason: "empty reference", feedItemUid }
  }

  const { data: unpaid, error: unpaidErr } = await supabase
    .from("match_players")
    .select("id, match_id, matches(date, price), users(name)")
    .eq("has_paid", false)

  if (unpaidErr) {
    return { status: "skipped", reason: `lookup failed: ${unpaidErr.message}`, feedItemUid }
  }

  const candidates = ((unpaid ?? []) as UnpaidPlayerRow[]).filter((row) => {
    const m = matchOf(row)
    if (!m) return false
    const code = normalizeRef(paymentRef(m.date, row.id, nameOf(row)))
    if (!payerRef.includes(code)) return false
    const expectedMinor = Math.round(m.price * 100)
    return item.amount.minorUnits === expectedMinor
  })

  if (candidates.length !== 1) {
    // No single player owns this money. Before giving up, see whether it is a
    // kumbara contribution — that reference is a plain campaign code with no
    // player and no expected amount, so it is checked LAST: a payment that
    // deterministically matches a player must never be diverted to the campaign.
    if (isPiggyReference(item.reference)) {
      return recordPiggyContribution(supabase, item)
    }

    return {
      status: "unmatched",
      reason: candidates.length === 0 ? "no code+amount match" : "ambiguous (multiple candidates)",
      feedItemUid,
    }
  }

  const matchPlayerId = candidates[0].id

  // 4. Mark the player paid, then record the link on the bank payment.
  const { error: payErr } = await supabase
    .from("match_players")
    .update({ has_paid: true })
    .eq("id", matchPlayerId)

  if (payErr) {
    return { status: "skipped", reason: `mark paid failed: ${payErr.message}`, feedItemUid }
  }

  await supabase
    .from("bank_payments")
    .update({ matched_match_player_id: matchPlayerId, match_status: "matched" })
    .eq("provider", "starling")
    .eq("feed_item_uid", feedItemUid)

  return { status: "matched", matchPlayerId, feedItemUid }
}
