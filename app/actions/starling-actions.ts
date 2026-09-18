"use server"

import { createServerClient } from "../lib/supabase"
import { getCurrentPlayer } from "../lib/supabase-ssr"
import { isPlaceholderPhone } from "../lib/phone"
import { normalizeRef } from "../lib/payment-ref"
import {
  filterPayerCandidates,
  learnPayerAlias,
  recordPiggyContribution,
  toPayerCandidates,
} from "../lib/starling-match"

export type UnpaidPlayerOption = {
  match_player_id: string
  name: string
  match_date: string
  price: number
}

export type UnmatchedPayment = {
  id: string
  feed_item_uid: string
  amount_minor: number
  currency: string
  reference: string | null
  counterparty_name: string | null
  transaction_time: string
  // Open registrations this payer's known users could be paying for (same
  // amount, inside the matcher's date window). Empty when the payer is unknown.
  suggestions: UnpaidPlayerOption[]
}

type UnpaidRow = {
  id: string
  match_id: string
  user_id: string
  matches: { date: string; price: number } | { date: string; price: number }[] | null
  users: { name: string } | { name: string }[] | null
}

function toOption(row: UnpaidRow): UnpaidPlayerOption {
  const user = Array.isArray(row.users) ? row.users[0] : row.users
  const match = Array.isArray(row.matches) ? row.matches[0] : row.matches
  return {
    match_player_id: row.id,
    name: user?.name ?? "—",
    match_date: match?.date ?? "",
    price: match?.price ?? 0,
  }
}

async function loadUnpaidRows(): Promise<UnpaidRow[]> {
  const supabase = createServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("match_players")
    .select("id, match_id, user_id, matches(date, price), users(name)")
    .eq("has_paid", false)

  if (error) {
    console.error("loadUnpaidRows:", error.message)
    return []
  }
  return (data ?? []) as unknown as UnpaidRow[]
}

// List Starling payments that arrived but did not auto-match (payer typed a
// wrong/missing reference and is not a known payer, or is known but nothing
// open fits). Powers the admin reconcile screen.
export async function listUnmatchedBankPayments(): Promise<UnmatchedPayment[]> {
  const supabase = createServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("bank_payments")
    .select("id, feed_item_uid, amount_minor, currency, reference, counterparty_name, transaction_time")
    .eq("match_status", "unmatched")
    .eq("direction", "IN")
    .order("transaction_time", { ascending: false })

  if (error) {
    console.error("listUnmatchedBankPayments:", error.message)
    return []
  }
  const payments = (data ?? []) as Omit<UnmatchedPayment, "suggestions">[]
  if (payments.length === 0) return []

  // One alias lookup for every payer in the queue, then the same candidate
  // filter the matcher uses (minus its auto-pick rules — the admin decides).
  const keys = Array.from(new Set(payments.map((p) => normalizeRef(p.counterparty_name)).filter(Boolean)))
  const [{ data: aliasRows }, unpaid] = await Promise.all([
    keys.length
      ? supabase.from("payer_aliases").select("payer_key, user_id").in("payer_key", keys)
      : Promise.resolve({ data: [] as { payer_key: string; user_id: string }[] }),
    loadUnpaidRows(),
  ])
  const usersByKey = new Map<string, string[]>()
  for (const a of aliasRows ?? []) {
    usersByKey.set(a.payer_key, [...(usersByKey.get(a.payer_key) ?? []), a.user_id])
  }
  const candidates = toPayerCandidates(unpaid)
  const optionById = new Map(unpaid.map((r) => [r.id, toOption(r)]))

  return payments.map((p) => {
    const users = usersByKey.get(normalizeRef(p.counterparty_name)) ?? []
    const fits = users.length
      ? filterPayerCandidates(candidates, users, p.amount_minor, p.transaction_time)
      : []
    return {
      ...p,
      suggestions: fits.map((c) => optionById.get(c.matchPlayerId)).filter((o): o is UnpaidPlayerOption => !!o),
    }
  })
}

// Players who still owe money, for the manual-link picker.
export async function listUnpaidPlayers(): Promise<UnpaidPlayerOption[]> {
  return (await loadUnpaidRows()).map(toOption)
}

// Count an unmatched payment as a kumbara contribution — the fallback for when
// someone transfers money without the campaign reference (or misspells it).
export async function assignBankPaymentToPiggy(feedItemUid: string) {
  const supabase = createServerClient()
  if (!supabase) return { success: false, error: "Database connection failed" }

  const { data, error } = await supabase
    .from("bank_payments")
    .select("feed_item_uid, amount_minor, currency, direction, reference, counterparty_name, transaction_time")
    .eq("provider", "starling")
    .eq("feed_item_uid", feedItemUid)
    .single()

  if (error || !data) return { success: false, error: error?.message ?? "Payment not found" }

  const result = await recordPiggyContribution(supabase, {
    feedItemUid: data.feed_item_uid,
    categoryUid: "",
    amount: { currency: data.currency, minorUnits: data.amount_minor },
    direction: (data.direction as "IN" | "OUT") ?? "IN",
    status: "SETTLED",
    source: "ADMIN_ASSIGNED",
    reference: data.reference ?? undefined,
    counterPartyName: data.counterparty_name ?? undefined,
    transactionTime: data.transaction_time,
  })

  if (result.status !== "campaign") {
    return { success: false, error: result.status === "skipped" ? result.reason : "Could not record" }
  }
  return { success: true }
}

// Manually link an unmatched payment to a player (admin reconcile fallback).
// Also teaches the matcher: next time this bank name pays for this player, no
// reference is needed.
export async function linkBankPayment(feedItemUid: string, matchPlayerId: string) {
  const supabase = createServerClient()
  if (!supabase) return { success: false, error: "Database connection failed" }

  const [{ data: registration, error: regErr }, { data: payment }] = await Promise.all([
    supabase.from("match_players").select("user_id").eq("id", matchPlayerId).maybeSingle(),
    supabase
      .from("bank_payments")
      .select("counterparty_name")
      .eq("provider", "starling")
      .eq("feed_item_uid", feedItemUid)
      .maybeSingle(),
  ])
  if (regErr) return { success: false, error: regErr.message }
  if (!registration) return { success: false, error: "Registration not found" }

  const { error: payErr } = await supabase
    .from("match_players")
    .update({ has_paid: true })
    .eq("id", matchPlayerId)
  if (payErr) return { success: false, error: payErr.message }

  const { error: linkErr } = await supabase
    .from("bank_payments")
    .update({ matched_match_player_id: matchPlayerId, match_status: "matched", match_method: "manual" })
    .eq("provider", "starling")
    .eq("feed_item_uid", feedItemUid)
  if (linkErr) return { success: false, error: linkErr.message }

  await learnPayerAlias(supabase, payment?.counterparty_name, registration.user_id, "manual")

  return { success: true }
}

// Detach every bank payment that points at a match_players row about to be
// deleted, so the FK's ON DELETE SET NULL never leaves a "matched" payment with
// no player behind it. Runs server-side because bank_payments is service-role
// write-only. In practice a paid player cannot be removed at all (see
// removePlayerFromMatch in data-service.ts), so this is belt-and-braces.
// Aliases are left alone: a wrong one is removed by its owner or the admin.
export async function unlinkBankPaymentsForMatchPlayer(matchPlayerId: string) {
  const supabase = createServerClient()
  if (!supabase) return { success: false, error: "Database connection failed" }

  const { error } = await supabase
    .from("bank_payments")
    .update({ matched_match_player_id: null, match_status: "unmatched", match_method: null })
    .eq("matched_match_player_id", matchPlayerId)
  if (error) return { success: false, error: error.message }

  return { success: true }
}

// ---------------------------------------------------------------------------
// Payer aliases — what the payment dialog and the profile page may know.
//
// Privacy rule: a bank payer name is personal data. A caller sees a name only
// when that same bank name has also paid for the caller's own player — the
// owner trivially, a host who pays for their guests, nobody else. `known` and
// `phoneOnFile` are safe for anyone: they say nothing beyond "has paid before"
// and "has a number on file" (the profile page already shows a masked number).
// ---------------------------------------------------------------------------

export type PayerInfo = {
  known: boolean
  phoneOnFile: boolean
  names: string[] | null
  viewerSignedIn: boolean
}

type AliasRow = { id: string; payer_key: string; payer_name: string; match_count: number; last_seen: string }

// One round trip for a whole player list: the match page prefetches every
// player's PayerInfo as soon as the list renders, so the payment dialog can
// open with the right tabs instead of adding the Otomatik tab a beat later.
export async function getPayerInfoBatch(userIds: string[]): Promise<Record<string, PayerInfo>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  const out: Record<string, PayerInfo> = {}
  const none = (): PayerInfo => ({ known: false, phoneOnFile: false, names: null, viewerSignedIn: false })
  for (const id of ids) out[id] = none()

  const supabase = createServerClient()
  if (!supabase || ids.length === 0) return out

  const [{ data: users }, { data: aliasRows, error }, viewer] = await Promise.all([
    supabase.from("users").select("id, phone").in("id", ids),
    supabase
      .from("payer_aliases")
      .select("id, user_id, payer_key, payer_name, match_count, last_seen")
      .in("user_id", ids)
      .order("match_count", { ascending: false }),
    getCurrentPlayer(),
  ])
  if (error) {
    console.error("getPayerInfoBatch:", error.message)
    return out
  }

  // Bank names the viewer may see: the ones that have also paid for the
  // viewer's own player (their own aliases). Owner sees everything of theirs.
  let viewerKeys = new Set<string>()
  if (viewer) {
    const { data: mine } = await supabase.from("payer_aliases").select("payer_key").eq("user_id", viewer.id)
    viewerKeys = new Set((mine ?? []).map((m: { payer_key: string }) => m.payer_key))
  }

  const phoneById = new Map((users ?? []).map((u: { id: string; phone: string | null }) => [u.id, u.phone]))
  const aliasesByUser = new Map<string, (AliasRow & { user_id: string })[]>()
  for (const a of (aliasRows ?? []) as (AliasRow & { user_id: string })[]) {
    aliasesByUser.set(a.user_id, [...(aliasesByUser.get(a.user_id) ?? []), a])
  }

  for (const id of ids) {
    const aliases = aliasesByUser.get(id) ?? []
    const known = aliases.length > 0
    let names: string[] | null = null
    if (known && viewer) {
      const visible =
        viewer.id === id ? aliases : aliases.filter((a) => viewerKeys.has(a.payer_key))
      names = visible.length ? visible.map((a) => a.payer_name) : null
    }
    out[id] = {
      known,
      phoneOnFile: !isPlaceholderPhone(phoneById.get(id)),
      names,
      viewerSignedIn: !!viewer,
    }
  }
  return out
}

export async function getPayerInfo(userId: string): Promise<PayerInfo> {
  const batch = await getPayerInfoBatch([userId])
  return batch[userId] ?? { known: false, phoneOnFile: false, names: null, viewerSignedIn: false }
}

export type MyPayerAlias = {
  id: string
  payer_name: string
  match_count: number
  last_seen: string
}

// The signed-in player's own aliases, for the profile card. Empty when signed out.
export async function getMyPayerAliases(): Promise<MyPayerAlias[]> {
  const supabase = createServerClient()
  const viewer = await getCurrentPlayer()
  if (!supabase || !viewer) return []

  const { data, error } = await supabase
    .from("payer_aliases")
    .select("id, payer_name, match_count, last_seen")
    .eq("user_id", viewer.id)
    .order("match_count", { ascending: false })

  if (error) {
    console.error("getMyPayerAliases:", error.message)
    return []
  }
  return (data ?? []) as MyPayerAlias[]
}

// "That account is not mine": the owner's correction tool.
export async function removeMyPayerAlias(aliasId: string): Promise<{ ok: boolean }> {
  const supabase = createServerClient()
  const viewer = await getCurrentPlayer()
  if (!supabase || !viewer || !aliasId) return { ok: false }

  const { error } = await supabase
    .from("payer_aliases")
    .delete()
    .eq("id", aliasId)
    .eq("user_id", viewer.id)

  if (error) {
    console.error("removeMyPayerAlias:", error.message)
    return { ok: false }
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Admin reconcile screen: the learned list and a delete.
// ---------------------------------------------------------------------------

export type PayerAliasAdminRow = {
  id: string
  payer_key: string
  payer_name: string
  user_id: string
  user_name: string
  match_count: number
  last_seen: string
  source: string
}

export async function listPayerAliases(): Promise<PayerAliasAdminRow[]> {
  const supabase = createServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("payer_aliases")
    .select("id, payer_key, payer_name, user_id, match_count, last_seen, source, users(name)")
    .order("payer_key")
    .order("match_count", { ascending: false })

  if (error) {
    console.error("listPayerAliases:", error.message)
    return []
  }
  return (data ?? []).map((row: any) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users
    return {
      id: row.id,
      payer_key: row.payer_key,
      payer_name: row.payer_name,
      user_id: row.user_id,
      user_name: user?.name ?? "—",
      match_count: row.match_count,
      last_seen: row.last_seen,
      source: row.source,
    }
  })
}

export async function deletePayerAlias(aliasId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient()
  if (!supabase) return { success: false, error: "Database connection failed" }

  const { error } = await supabase.from("payer_aliases").delete().eq("id", aliasId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
