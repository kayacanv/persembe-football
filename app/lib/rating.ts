// Player ratings: from crowd votes (plan-ratings.md) to the numbers on the card,
// plus the strength and play-style values team building reads.
//
// Pipeline: each stat = trimmed mean of the voters' values (60-99) → five
// position ratings = weighted mix of the 8 stats, rounded and kept within 70-99.
// The player's overall is the rating at their self-chosen card position.

import type { User } from "./types"
import { RATING_STATS, type RatingStat } from "./rating-stats"

// A player gets numbers once this many different people have rated them.
export const MIN_VOTERS = 5

export const POSITION_GROUPS = ["cf", "cm", "wm", "fb", "cb"] as const
export type PositionGroup = (typeof POSITION_GROUPS)[number]
export type PositionRatings = Record<PositionGroup, number>

// The six stats shown on the card and profile (teamwork and work rate are
// voted and weighted, but not shown).
export const CARD_STATS = ["pac", "sho", "pas", "dri", "def", "phy"] as const
export type CardStat = (typeof CARD_STATS)[number]
export type CardStats = Record<CardStat, number>

// Public row from player_ratings; everything but `voters` is null until MIN_VOTERS.
export type PlayerRating = { voters: number } & Record<PositionGroup | CardStat, number | null>

// Columns to embed as `player_ratings (...)` when loading users.
export const PLAYER_RATING_COLUMNS = ["voters", ...POSITION_GROUPS, ...CARD_STATS].join(", ")

// Weights in % per position group (each row sums to 100).
const WEIGHTS: Record<PositionGroup, Partial<Record<RatingStat, number>>> = {
  cf: { pac: 20, sho: 30, pas: 15, dri: 15, phy: 10, tw: 5, wr: 5 },
  cm: { pac: 15, sho: 13, pas: 35, dri: 15, def: 5, phy: 7, tw: 5, wr: 5 },
  wm: { pac: 25, sho: 10, pas: 25, dri: 25, phy: 5, tw: 5, wr: 5 },
  fb: { pac: 20, sho: 7, pas: 20, dri: 20, def: 15, phy: 5, tw: 5, wr: 8 },
  cb: { pac: 10, pas: 25, dri: 10, def: 30, phy: 15, tw: 5, wr: 5 },
}

// Card position → rating group. GK has no stats of its own, so it reads as CB.
const GROUP_OF_POSITION: Record<string, PositionGroup> = {
  ST: "cf",
  CF: "cf",
  CAM: "cm",
  CM: "cm",
  CDM: "cm",
  RW: "wm",
  LW: "wm",
  RM: "wm",
  LM: "wm",
  RB: "fb",
  LB: "fb",
  RWB: "fb",
  LWB: "fb",
  CB: "cb",
  GK: "cb",
}

export function positionGroup(cardPosition?: string | null): PositionGroup {
  return GROUP_OF_POSITION[(cardPosition || "").toUpperCase()] ?? "cm"
}

// Trimmed mean: with MIN_VOTERS or more values, drop the single highest and lowest.
function trimmedMean(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const kept = sorted.length >= MIN_VOTERS ? sorted.slice(1, -1) : sorted
  return kept.reduce((sum, v) => sum + v, 0) / kept.length
}

// Position ratings never show below 70 (player_ratings enforces 70-99).
const MIN_POSITION_RATING = 70

// All votes for one player → the public row. `votes` holds one entry per
// (voter, stat); every saved rating covers all 8 stats.
export function computePlayerRating(votes: { voter_id: string; stat: RatingStat; value: number }[]): PlayerRating {
  const voters = new Set(votes.map((v) => v.voter_id)).size
  const empty: PlayerRating = {
    voters,
    ...(Object.fromEntries([...POSITION_GROUPS, ...CARD_STATS].map((k) => [k, null])) as Record<
      PositionGroup | CardStat,
      null
    >),
  }
  if (voters < MIN_VOTERS) return empty

  const stat = {} as Record<RatingStat, number>
  for (const s of RATING_STATS) {
    const values = votes.filter((v) => v.stat === s).map((v) => v.value)
    if (values.length === 0) return empty
    stat[s] = trimmedMean(values)
  }

  const result = { ...empty }
  for (const group of POSITION_GROUPS) {
    const raw = Object.entries(WEIGHTS[group]).reduce((sum, [s, w]) => sum + stat[s as RatingStat] * (w as number), 0) / 100
    result[group] = Math.max(MIN_POSITION_RATING, Math.min(99, Math.round(raw)))
  }
  for (const s of CARD_STATS) result[s] = Math.round(stat[s])
  return result
}

// A `player_ratings (...)` embed arrives as an object (one-to-one) or, defensively, an array.
export function oneRating(embed: unknown): PlayerRating | null {
  const row = Array.isArray(embed) ? embed[0] : embed
  return row && typeof row === "object" ? (row as PlayerRating) : null
}

export function hasRatings(r?: PlayerRating | null): r is PlayerRating & PositionRatings {
  return !!r && POSITION_GROUPS.every((g) => typeof r[g] === "number")
}

// The six stat averages, or null until enough voters.
export function cardStats(r?: PlayerRating | null): CardStats | null {
  return r && CARD_STATS.every((s) => typeof r[s] === "number") ? (r as CardStats) : null
}

// The overall shown on the card: the rating at the player's chosen position.
// null = not enough voters yet (the card shows "?").
export function overallFor(rating: PlayerRating | null | undefined, cardPosition?: string | null): number | null {
  return hasRatings(rating) ? rating[positionGroup(cardPosition)] : null
}

const DEFAULT_OVERALL = 70

// Strength for team building: the voted overall when there is one, else the
// old self-set card overall.
export function playerStrength(p: Pick<User, "card_overall" | "card_position" | "rating">): number {
  return overallFor(p.rating, p.card_position) ?? p.card_overall ?? DEFAULT_OVERALL
}

// Attack lean from the card position: 1 = pure defender … 5 = pure attacker.
const ATTACK_LEAN: Record<string, number> = {
  GK: 1,
  CB: 1,
  RB: 2,
  LB: 2,
  CDM: 2,
  RWB: 2.5,
  LWB: 2.5,
  CM: 3,
  RM: 3.5,
  LM: 3.5,
  CAM: 4,
  RW: 4.5,
  LW: 4.5,
  CF: 5,
  ST: 5,
}

export function attackLean(p: Pick<User, "card_position">): number {
  return ATTACK_LEAN[(p.card_position || "").toUpperCase()] ?? 3
}
