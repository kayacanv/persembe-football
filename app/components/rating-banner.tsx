"use client"

// Home-page nudge to the /oyla rating page. Only for signed-in players who
// still have teammates to rate; renders nothing otherwise.

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Vote } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { countPendingRatings } from "@/app/actions/rating-actions"
import { useCurrentPlayer } from "@/app/lib/use-current-player"
import { useTranslation } from "@/lib/i18n/useTranslation"

export function RatingBanner() {
  const { t } = useTranslation()
  const { player } = useCurrentPlayer()
  const [pending, setPending] = useState(0)

  useEffect(() => {
    if (!player) {
      setPending(0)
      return
    }
    let active = true
    countPendingRatings()
      .then((n) => active && setPending(n))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [player?.id])

  if (!player || pending === 0) return null

  return (
    <Link href="/oyla" className="mb-3 block">
      <Card className="border-primary/40 transition-colors hover:border-primary">
        <CardContent className="flex items-center gap-3 p-4">
          <Vote className="h-8 w-8 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t("rate.bannerTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("rate.bannerDesc", { count: pending })}</p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  )
}
