"use server"

// Admin-only writes for the kumbara (piggy bank).
//
// Starling transfers land by themselves (webhook + cron), but money sent any
// other way — Revolut, cash, a bank the app can't see — has no feed item to
// match against. Those get typed in here by hand: a name and an amount, stored
// with `source = 'manual'` so they are always distinguishable from bank rows.
//
// Service-role only, because `piggy_contributions` is read-public / write-locked.

import { createServerClient } from "../lib/supabase"
import { ACTIVE_PIGGY } from "../config/piggy"

export type ManualContribution = {
  id: string
  amount_minor: number
  display_name: string | null
  paid_at: string
}

export async function addManualContribution(
  name: string,
  amountMinor: number,
  campaign: string = ACTIVE_PIGGY.slug,
): Promise<{ success: boolean; error?: string }> {
  const displayName = name.trim()
  if (!displayName) return { success: false, error: "Name is required" }
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return { success: false, error: "Amount must be a positive number" }
  }

  const supabase = createServerClient()
  if (!supabase) return { success: false, error: "Database connection failed" }

  // `external_id` only exists to dedupe the bank feed; a hand-typed row has no
  // natural key, so a random one keeps the unique (source, external_id) index happy.
  const { error } = await supabase.from("piggy_contributions").insert({
    campaign,
    source: "manual",
    external_id: crypto.randomUUID(),
    amount_minor: amountMinor,
    currency: "GBP",
    display_name: displayName,
    paid_at: new Date().toISOString(),
  })

  if (error) {
    console.error("addManualContribution:", error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// The manually-added rows only — so a typo can be found and undone without the
// bank-fed contributions getting in the way.
export async function listManualContributions(
  campaign: string = ACTIVE_PIGGY.slug,
): Promise<ManualContribution[]> {
  const supabase = createServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("piggy_contributions")
    .select("id, amount_minor, display_name, paid_at")
    .eq("campaign", campaign)
    .eq("source", "manual")
    .order("paid_at", { ascending: false })

  if (error) {
    console.error("listManualContributions:", error.message)
    return []
  }
  return (data ?? []) as ManualContribution[]
}

// Undo a mistyped manual entry. The `source` filter makes it impossible to
// delete a real bank-fed contribution through this path.
export async function deleteManualContribution(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient()
  if (!supabase) return { success: false, error: "Database connection failed" }

  const { error } = await supabase
    .from("piggy_contributions")
    .delete()
    .eq("id", id)
    .eq("source", "manual")

  if (error) {
    console.error("deleteManualContribution:", error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}
