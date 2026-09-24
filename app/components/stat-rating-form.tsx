"use client"

// The 8-stat rating form: one block per stat with the fixed value buttons and,
// underneath, the voter's own earlier votes on that stat for up to 3 other
// players (high / mid / low) so they stay consistent. Used by the /oyla page
// and the "Oylarım" tab on a profile.

import { useMemo } from "react"
import {
  RATING_STATS,
  RATING_VALUES,
  pickReminders,
  type MyRating,
  type RatingStat,
  type RatingValue,
  type StatValues,
} from "@/app/lib/rating-stats"
import { useTranslation } from "@/lib/i18n/useTranslation"

export type DraftValues = Partial<StatValues>

export function StatRatingForm({
  targetId,
  values,
  onChange,
  mine,
  disabled,
}: {
  targetId: string
  values: DraftValues
  onChange: (stat: RatingStat, value: RatingValue) => void
  mine: MyRating[]
  disabled?: boolean
}) {
  const { t } = useTranslation()

  // Picked once per player, so the hints don't reshuffle while tapping.
  const reminders = useMemo(() => {
    const used = new Set<string>()
    return Object.fromEntries(RATING_STATS.map((s) => [s, pickReminders(mine, s, targetId, used)])) as Record<
      RatingStat,
      MyRating[]
    >
  }, [mine, targetId])

  return (
    <div className="space-y-3">
      {RATING_STATS.map((stat) => (
        <div key={stat} className="rounded-lg border bg-background p-3">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold">{t(`rate.stats.${stat}.label`)}</span>
            <span className="truncate text-xs text-muted-foreground">{t(`rate.stats.${stat}.hint`)}</span>
          </div>
          <div role="radiogroup" aria-label={t(`rate.stats.${stat}.label`)} className="grid grid-cols-7 gap-1">
            {RATING_VALUES.map((v) => {
              const selected = values[stat] === v
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => onChange(stat, v)}
                  className={`h-11 rounded-md border text-sm font-semibold tabular-nums transition-colors disabled:opacity-60 ${
                    selected ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                  }`}
                >
                  {v}
                </button>
              )
            })}
          </div>
          {reminders[stat].length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("rate.yourVotes")}{" "}
              {reminders[stat].map((r, i) => (
                <span key={r.targetId}>
                  {i > 0 && " · "}
                  {r.name} <span className="font-semibold text-foreground">{r.value}</span>
                </span>
              ))}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
