// The 8 voted stats and the allowed vote values (plan-ratings.md). Shared by
// the voting UI and app/actions/rating-actions.ts; mirrors the checks in
// add-stat-ratings.sql — keep the two in sync.

export const RATING_STATS = ["pac", "sho", "pas", "dri", "def", "phy", "tw", "wr"] as const
export type RatingStat = (typeof RATING_STATS)[number]

export const RATING_VALUES = [60, 70, 80, 85, 90, 95, 99] as const
export type RatingValue = (typeof RATING_VALUES)[number]

export type StatValues = Record<RatingStat, RatingValue>

export function isRatingStat(s: unknown): s is RatingStat {
  return typeof s === "string" && (RATING_STATS as readonly string[]).includes(s)
}

export function isRatingValue(v: unknown): v is RatingValue {
  return typeof v === "number" && (RATING_VALUES as readonly number[]).includes(v)
}

// All 8 stats present with allowed values — a partial rating is never saved.
export function isCompleteRating(values: Partial<Record<string, unknown>> | null | undefined): values is StatValues {
  return !!values && RATING_STATS.every((s) => isRatingValue(values[s]))
}

// One of the voter's own earlier votes, used for the reminders under each stat.
export type MyRating = { targetId: string; name: string; stat: RatingStat; value: RatingValue }

// Up to 3 reminders for a stat: one from the voter's top third, one from the
// middle, one from the bottom third of their own votes on that stat. Random
// within each band; names already used by other stats are avoided when possible.
export function pickReminders(
  mine: MyRating[],
  stat: RatingStat,
  excludeTargetId: string,
  used: Set<string>,
): MyRating[] {
  const pool = mine
    .filter((r) => r.stat === stat && r.targetId !== excludeTargetId)
    .sort((a, b) => b.value - a.value)
  if (pool.length <= 3) return pool

  const third = Math.floor(pool.length / 3)
  const bands = [pool.slice(0, third), pool.slice(third, pool.length - third), pool.slice(pool.length - third)]

  const picks: MyRating[] = []
  for (const band of bands) {
    if (band.length === 0) continue
    const fresh = band.filter((r) => !used.has(r.targetId))
    const from = fresh.length > 0 ? fresh : band
    const pick = from[Math.floor(Math.random() * from.length)]
    picks.push(pick)
    used.add(pick.targetId)
  }
  return picks
}
