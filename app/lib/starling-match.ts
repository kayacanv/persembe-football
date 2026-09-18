// Shared Starling -> player matching logic. SERVER ONLY.
//
// Used by BOTH the real-time webhook (app/api/webhooks/starling/feed-item) and
// the cron backstop (app/api/cron/starling-sync). Idempotent: re-processing the
// same feed item never duplicates a row or re-marks a player.
//
// Two ways a payment finds its player, tried in this order:
//   1. reference — the payer typed the NAM-DDMM-WXYZ code (deterministic).
//   2. payer     — no usable reference, but the bank payer name is one we have
//                  learned before (payer_aliases) and exactly one open
//                  registration of theirs fits the amount and date window.
// Between the two sits the kumbara (piggy bank) reference check, so a known
// payer who writes KUMBARA is never diverted to a match.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { StarlingFeedItem } from "./starling-server"
import { normalizeRef, paymentRef } from "./payment-ref"
import { ACTIVE_PIGGY, isPiggyReference } from "@/app/config/piggy"

export type MatchMethod = "reference" | "payer"

export type ProcessResult =
  | { status: "skipped"; reason: string; feedItemUid: string }
  | { status: "ignored"; reason: string; feedItemUid: string }
  | { status: "matched"; matchPlayerId: string; method: MatchMethod; feedItemUid: string }
  | { status: "campaign"; campaign: string; feedItemUid: string }
  | { status: "unmatched"; reason: string; feedItemUid: string }

type UnpaidPlayerRow = {
  id: string
  match_id: string
  user_id: string
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

// ---------------------------------------------------------------------------
// Payer-name fallback: pure helpers (no I/O) so they can be exercised with
// fixtures and reused by the admin suggestion list.
// ---------------------------------------------------------------------------

// How far from the transaction time a registration's match may be. Covers
// paying a week ahead and forgetting for ~6 matches, but keeps fresh money off
// the years-old unpaid rows.
export const PAYER_WINDOW_BEFORE_DAYS = 45
export const PAYER_WINDOW_AFTER_DAYS = 14

export type PayerAliasRow = { user_id: string; match_count: number }

export type PayerCandidate = {
  matchPlayerId: string
  userId: string
  matchDate: string // DD.MM.YYYY as stored
  priceMinor: number
}

// "DD.MM.YYYY" -> UTC noon of that day, or null when malformed.
export function parseMatchDate(date: string): Date | null {
  const [dd, mm, yyyy] = (date ?? "").split(".").map((p) => Number.parseInt(p, 10))
  if (!dd || !mm || !yyyy) return null
  const d = new Date(Date.UTC(yyyy, mm - 1, dd, 12))
  return Number.isNaN(d.getTime()) ? null : d
}

// Open registrations that this payment could settle: owned by one of the
// payer's users, priced exactly at the amount, and dated inside the window.
export function filterPayerCandidates(
  candidates: PayerCandidate[],
  aliasUserIds: Iterable<string>,
  amountMinor: number,
  transactionTime: string,
): PayerCandidate[] {
  const users = new Set(aliasUserIds)
  const tx = new Date(transactionTime).getTime()
  if (Number.isNaN(tx)) return []
  const dayMs = 24 * 60 * 60 * 1000
  const min = tx - PAYER_WINDOW_BEFORE_DAYS * dayMs
  const max = tx + PAYER_WINDOW_AFTER_DAYS * dayMs

  return candidates.filter((c) => {
    if (!users.has(c.userId)) return false
    if (c.priceMinor !== amountMinor) return false
    const d = parseMatchDate(c.matchDate)
    if (!d) return false
    const t = d.getTime()
    return t >= min && t <= max
  })
}

function nearestToTx(candidates: PayerCandidate[], transactionTime: string): PayerCandidate {
  const tx = new Date(transactionTime).getTime()
  return [...candidates].sort((a, b) => {
    const da = Math.abs((parseMatchDate(a.matchDate)?.getTime() ?? 0) - tx)
    const db = Math.abs((parseMatchDate(b.matchDate)?.getTime() ?? 0) - tx)
    if (da !== db) return da - db
    // Tie (same distance): the earlier match first, then a stable id order.
    const ta = parseMatchDate(a.matchDate)?.getTime() ?? 0
    const tb = parseMatchDate(b.matchDate)?.getTime() ?? 0
    return ta !== tb ? ta - tb : a.matchPlayerId.localeCompare(b.matchPlayerId)
  })[0]
}

// Decide which (already filtered) candidate the money belongs to.
//   one candidate            -> that one
//   several                  -> the primary user's (most payments explained by this
//                               payer), nearest match date to the transaction
//   primary has none         -> if exactly one other user has candidates, theirs;
//                               otherwise ambiguous (admin queue)
export function pickPayerCandidate(
  candidates: PayerCandidate[],
  aliases: PayerAliasRow[],
  transactionTime: string,
): { matchPlayerId: string } | { reason: string } {
  if (candidates.length === 0) return { reason: "no open registration for payer" }
  if (candidates.length === 1) return { matchPlayerId: candidates[0].matchPlayerId }

  const primary = [...aliases].sort((a, b) => b.match_count - a.match_count)[0]
  const primaryCands = primary ? candidates.filter((c) => c.userId === primary.user_id) : []
  if (primaryCands.length > 0) {
    return { matchPlayerId: nearestToTx(primaryCands, transactionTime).matchPlayerId }
  }

  const byUser = new Map<string, PayerCandidate[]>()
  for (const c of candidates) byUser.set(c.userId, [...(byUser.get(c.userId) ?? []), c])
  if (byUser.size === 1) {
    return { matchPlayerId: nearestToTx(candidates, transactionTime).matchPlayerId }
  }
  return { reason: "ambiguous payer (several users)" }
}

// ---------------------------------------------------------------------------
// I/O helpers
// ---------------------------------------------------------------------------

// Remember that money from this bank payer name settled this player's fee.
// Never throws: a failed alias write must not undo a successful match.
export async function learnPayerAlias(
  supabase: SupabaseClient,
  counterpartyName: string | null | undefined,
  userId: string | null | undefined,
  source: "auto" | "manual" = "auto",
): Promise<void> {
  const key = normalizeRef(counterpartyName)
  if (!key || !userId) return
  const { error } = await supabase.rpc("payer_alias_touch", {
    p_key: key,
    p_name: (counterpartyName ?? "").trim(),
    p_user_id: userId,
    p_source: source,
  })
  if (error) console.error("learnPayerAlias:", error.message)
}

async function loadUnpaidRows(supabase: SupabaseClient) {
  return supabase
    .from("match_players")
    .select("id, match_id, user_id, matches(date, price), users(name)")
    .eq("has_paid", false)
}

export function toPayerCandidates(rows: UnpaidPlayerRow[]): PayerCandidate[] {
  const out: PayerCandidate[] = []
  for (const row of rows) {
    const m = matchOf(row)
    if (!m) continue
    out.push({
      matchPlayerId: row.id,
      userId: row.user_id,
      matchDate: m.date,
      priceMinor: Math.round(m.price * 100),
    })
  }
  return out
}

async function markMatched(
  supabase: SupabaseClient,
  feedItemUid: string,
  matchPlayerId: string,
  method: MatchMethod,
): Promise<string | null> {
  const { error: payErr } = await supabase
    .from("match_players")
    .update({ has_paid: true })
    .eq("id", matchPlayerId)
  if (payErr) return payErr.message

  await supabase
    .from("bank_payments")
    .update({ matched_match_player_id: matchPlayerId, match_status: "matched", match_method: method })
    .eq("provider", "starling")
    .eq("feed_item_uid", feedItemUid)
  return null
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

  // 2. Read current state — bail if already settled one way or another (idempotency).
  const { data: existing } = await supabase
    .from("bank_payments")
    .select("id, match_status")
    .eq("provider", "starling")
    .eq("feed_item_uid", feedItemUid)
    .single()

  if (
    existing?.match_status === "matched" ||
    existing?.match_status === "campaign" ||
    existing?.match_status === "ignored"
  ) {
    return { status: "skipped", reason: `already ${existing.match_status}`, feedItemUid }
  }

  // 3. Money that is not a player's transfer: outgoing items, and top-ups from
  // our own main account into the space. Park them so they never sit in the
  // admin queue.
  if (item.direction !== "IN" || item.source === "INTERNAL_TRANSFER") {
    await supabase
      .from("bank_payments")
      .update({ match_status: "ignored" })
      .eq("provider", "starling")
      .eq("feed_item_uid", feedItemUid)
    const reason = item.direction !== "IN" ? "not incoming" : "internal transfer"
    return { status: "ignored", reason, feedItemUid }
  }

  const { data: unpaid, error: unpaidErr } = await loadUnpaidRows(supabase)
  if (unpaidErr) {
    return { status: "skipped", reason: `lookup failed: ${unpaidErr.message}`, feedItemUid }
  }
  const unpaidRows = (unpaid ?? []) as unknown as UnpaidPlayerRow[]

  // 4. Deterministic match: payer reference must contain a player's unique code
  // AND the amount must equal that match's price (in pence).
  const payerRef = normalizeRef(item.reference)
  if (payerRef) {
    const byCode = unpaidRows.filter((row) => {
      const m = matchOf(row)
      if (!m) return false
      const code = normalizeRef(paymentRef(m.date, row.id, nameOf(row)))
      if (!payerRef.includes(code)) return false
      return item.amount.minorUnits === Math.round(m.price * 100)
    })

    if (byCode.length === 1) {
      const row = byCode[0]
      const err = await markMatched(supabase, feedItemUid, row.id, "reference")
      if (err) return { status: "skipped", reason: `mark paid failed: ${err}`, feedItemUid }
      await learnPayerAlias(supabase, item.counterPartyName, row.user_id, "auto")
      return { status: "matched", matchPlayerId: row.id, method: "reference", feedItemUid }
    }

    if (byCode.length > 1) {
      return { status: "unmatched", reason: "ambiguous (multiple candidates)", feedItemUid }
    }
  }

  // 5. Kumbara: a plain campaign code with no player and no expected amount, so
  // it is checked only after the per-player code — a payment that
  // deterministically matches a player must never be diverted to the campaign.
  if (isPiggyReference(item.reference)) {
    return recordPiggyContribution(supabase, item)
  }

  // 6. Payer-name fallback: the reference was empty, stale or mistyped, but we
  // may already know whose money this is from earlier matched payments.
  const payerKey = normalizeRef(item.counterPartyName)
  if (!payerKey) {
    return { status: "unmatched", reason: payerRef ? "no code+amount match" : "empty reference", feedItemUid }
  }

  const { data: aliasRows, error: aliasErr } = await supabase
    .from("payer_aliases")
    .select("user_id, match_count")
    .eq("payer_key", payerKey)
  if (aliasErr) {
    return { status: "skipped", reason: `alias lookup failed: ${aliasErr.message}`, feedItemUid }
  }
  const aliases = (aliasRows ?? []) as PayerAliasRow[]
  if (aliases.length === 0) {
    return { status: "unmatched", reason: "unknown payer", feedItemUid }
  }

  const candidates = filterPayerCandidates(
    toPayerCandidates(unpaidRows),
    aliases.map((a) => a.user_id),
    item.amount.minorUnits,
    item.transactionTime,
  )
  const pick = pickPayerCandidate(candidates, aliases, item.transactionTime)
  if ("reason" in pick) {
    return { status: "unmatched", reason: pick.reason, feedItemUid }
  }

  const err = await markMatched(supabase, feedItemUid, pick.matchPlayerId, "payer")
  if (err) return { status: "skipped", reason: `mark paid failed: ${err}`, feedItemUid }

  const matchedRow = unpaidRows.find((r) => r.id === pick.matchPlayerId)
  await learnPayerAlias(supabase, item.counterPartyName, matchedRow?.user_id, "auto")

  return { status: "matched", matchPlayerId: pick.matchPlayerId, method: "payer", feedItemUid }
}
