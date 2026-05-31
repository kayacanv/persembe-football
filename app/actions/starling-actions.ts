"use server"

import { createServerClient } from "../lib/supabase"

export type UnmatchedPayment = {
  id: string
  feed_item_uid: string
  amount_minor: number
  currency: string
  reference: string | null
  counterparty_name: string | null
  transaction_time: string
}

export type UnpaidPlayerOption = {
  match_player_id: string
  name: string
  match_date: string
  price: number
}

// List Starling payments that arrived but did not auto-match (rare: payer typed
// a wrong/missing reference). Powers the admin reconcile screen.
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
  return (data ?? []) as UnmatchedPayment[]
}

// Players who still owe money, for the manual-link picker.
export async function listUnpaidPlayers(): Promise<UnpaidPlayerOption[]> {
  const supabase = createServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("match_players")
    .select("id, users(name), matches(date, price)")
    .eq("has_paid", false)

  if (error) {
    console.error("listUnpaidPlayers:", error.message)
    return []
  }

  return (data ?? []).map((row: any) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users
    const match = Array.isArray(row.matches) ? row.matches[0] : row.matches
    return {
      match_player_id: row.id,
      name: user?.name ?? "—",
      match_date: match?.date ?? "",
      price: match?.price ?? 0,
    }
  })
}

// Manually link an unmatched payment to a player (admin reconcile fallback).
export async function linkBankPayment(feedItemUid: string, matchPlayerId: string) {
  const supabase = createServerClient()
  if (!supabase) return { success: false, error: "Database connection failed" }

  const { error: payErr } = await supabase
    .from("match_players")
    .update({ has_paid: true })
    .eq("id", matchPlayerId)
  if (payErr) return { success: false, error: payErr.message }

  const { error: linkErr } = await supabase
    .from("bank_payments")
    .update({ matched_match_player_id: matchPlayerId, match_status: "matched" })
    .eq("provider", "starling")
    .eq("feed_item_uid", feedItemUid)
  if (linkErr) return { success: false, error: linkErr.message }

  return { success: true }
}
