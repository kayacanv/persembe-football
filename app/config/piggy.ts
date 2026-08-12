// Kumbara (piggy bank) campaign config.
//
// A kumbara is a whip-round for a pitch fee that has to be paid whether or not
// the match is played. Unlike a match payment there is no player, no
// registration and no fixed amount — anyone can throw in whatever they like.
//
// Starting the next campaign = edit ACTIVE_PIGGY below (and nothing else).
//
// PURE module: imports only the pure `normalizeRef` helper, so it is safe in
// both client components and the server-side Starling matcher.

import { normalizeRef } from "@/app/lib/payment-ref"

export type PiggyCampaign = {
  /** Stored on every contribution row; groups them into one campaign. */
  slug: string
  /**
   * Off hides the home-page banner and stops new bank transfers being counted.
   * The `/kumbara` page stays reachable so the final tally survives as a record.
   */
  active: boolean
  /** Target in pence. */
  goalMinor: number
  /** The reference payers type into their transfer. Shown verbatim in the UI. */
  refCode: string
  /**
   * Extra spellings accepted by the matcher, on top of `refCode`. Compared after
   * `normalizeRef` (uppercased, non-alphanumerics stripped), so punctuation and
   * casing are already handled — these are for genuinely different words.
   *
   * Keep them SPECIFIC. The campaign check runs as a fallback after the per-player
   * match, so a loose alias like "KMB" could swallow a mistyped player reference.
   */
  refAliases: string[]
  /** Starling Settle Up page; `?amount=` is appended by the UI. */
  settleUpUrl: string
  /** Suggested amounts in pence, offered as one-tap chips. */
  amountPresets: number[]
}

export const ACTIVE_PIGGY: PiggyCampaign = {
  slug: "kmb-1308",
  active: true,
  goalMinor: 17_000,
  // Case and punctuation are irrelevant — `normalizeRef` uppercases and strips
  // everything that isn't A-Z0-9 before comparing, so "kumbara" matches too.
  refCode: "KUMBARA",
  refAliases: [],
  settleUpUrl: "https://settleup.starlingbank.com/kayacan-vesek-6f4fc7",
  amountPresets: [500, 1_000],
}

/**
 * Does a payer-supplied bank reference belong to this campaign?
 * Substring match, because banks and payers append their own noise
 * ("KMB-1308 saha", "FROM ALI KMB1308").
 */
export function isPiggyReference(reference: string | null | undefined, campaign = ACTIVE_PIGGY): boolean {
  if (!campaign.active) return false
  const ref = normalizeRef(reference)
  if (!ref) return false
  return [campaign.refCode, ...campaign.refAliases]
    .map(normalizeRef)
    .filter(Boolean)
    .some((code) => ref.includes(code))
}
