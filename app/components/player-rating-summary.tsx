"use client"

import { CARD_STATS, POSITION_GROUPS, cardStats, hasRatings, type PlayerRating, type PositionGroup } from "@/app/lib/rating"
import { useTranslation } from "@/lib/i18n/useTranslation"

const POSITION_LABELS: Record<PositionGroup, string> = {
  cf: "CF",
  cm: "CM",
  wm: "RM/LM",
  fb: "RB/LB",
  cb: "CB",
}

// Profile panel under the card: the six voted stat averages and the five
// position ratings. Renders nothing until the player has enough voters.
export function PlayerRatingSummary({ rating }: { rating?: PlayerRating | null }) {
  const { t } = useTranslation()
  const stats = cardStats(rating)
  if (!stats || !hasRatings(rating)) return null

  return (
    <div className="mt-4 w-full max-w-[280px] rounded-lg border p-3">
      <p className="mb-2 text-sm font-semibold">{t("rate.summaryStats")}</p>
      <div className="space-y-1.5">
        {CARD_STATS.map((stat) => (
          <div key={stat} className="flex items-center gap-2 text-sm">
            <span className="w-24 shrink-0 text-muted-foreground">{t(`rate.stats.${stat}.label`)}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              {/* Bar spans the vote scale, 60-99. */}
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${((stats[stat] - 60) / 39) * 100}%` }}
              />
            </div>
            <span className="w-6 text-right font-semibold tabular-nums">{stats[stat]}</span>
          </div>
        ))}
      </div>

      <p className="mb-2 mt-4 text-sm font-semibold">{t("rate.summaryPositions")}</p>
      <div className="grid grid-cols-5 gap-1 text-center">
        {POSITION_GROUPS.map((group) => (
          <div key={group}>
            <div className="font-bold tabular-nums">{rating[group]}</div>
            <div className="text-[10px] text-muted-foreground">{POSITION_LABELS[group]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
