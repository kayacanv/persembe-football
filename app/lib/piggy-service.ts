// Reads for the kumbara (piggy bank) page. Browser client + anon key, like the
// rest of the app's reads.
//
// Only `piggy_contributions` is ever read here — never `bank_payments`, which
// holds the raw bank feed. A contribution row is just a name and an amount.

import { getSupabaseBrowserClient } from "./supabase"
import { ACTIVE_PIGGY } from "@/app/config/piggy"

export type PiggyContribution = {
  id: string
  amount_minor: number
  display_name: string | null
  paid_at: string
  source: string
}

export type PiggyTotals = {
  contributions: PiggyContribution[]
  collectedMinor: number
  goalMinor: number
  remainingMinor: number
  /** 0–1, clamped — a campaign can overshoot its goal. */
  progress: number
  reached: boolean
}

export async function getPiggyContributions(
  campaign: string = ACTIVE_PIGGY.slug,
): Promise<PiggyContribution[]> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("piggy_contributions")
    .select("id, amount_minor, display_name, paid_at, source")
    .eq("campaign", campaign)
    .order("paid_at", { ascending: false })

  if (error) {
    console.error("getPiggyContributions:", error.message)
    return []
  }
  return (data ?? []) as PiggyContribution[]
}

/** Contributions plus the derived numbers the page renders. */
export async function getPiggyTotals(campaign = ACTIVE_PIGGY): Promise<PiggyTotals> {
  const contributions = await getPiggyContributions(campaign.slug)
  const collectedMinor = contributions.reduce((sum, c) => sum + c.amount_minor, 0)
  const remainingMinor = Math.max(0, campaign.goalMinor - collectedMinor)

  return {
    contributions,
    collectedMinor,
    goalMinor: campaign.goalMinor,
    remainingMinor,
    progress: campaign.goalMinor > 0 ? Math.min(1, collectedMinor / campaign.goalMinor) : 0,
    reached: collectedMinor >= campaign.goalMinor,
  }
}

/**
 * The name a contributor is known by, for the public wall.
 *
 * Bank transfers arrive under a full legal name ("M Furkan Atasoy", "Serif Soner
 * Serbest") but people go by the word sitting just before the surname — Furkan,
 * Soner, Safa. Taking the second-to-last word gets that in every shape the feed
 * produces, and keeps surnames off a page anyone can open. A one-word name is
 * returned as-is.
 */
export function contributorName(full: string | null | undefined): string {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0]
}

/** £ with no trailing ".00" — "£170", "£12.50". */
export function formatPounds(minor: number): string {
  const pounds = minor / 100
  return `£${Number.isInteger(pounds) ? pounds.toString() : pounds.toFixed(2)}`
}
