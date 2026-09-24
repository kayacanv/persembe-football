"use client"

// Home-page entry to the teammate preferences tab, for signed-in players.
// Always shown when signed in, since preferences have no "done" state.

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Heart } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { countMyTeammatePreferences } from "@/app/actions/preference-actions"
import { useCurrentPlayer } from "@/app/lib/use-current-player"
import { useTranslation } from "@/lib/i18n/useTranslation"

export function PreferencesBanner() {
  const { t } = useTranslation()
  const { player } = useCurrentPlayer()
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    if (!player) {
      setCount(null)
      return
    }
    let active = true
    countMyTeammatePreferences()
      .then((n) => active && setCount(n))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [player?.id])

  if (!player || count === null) return null

  return (
    <Link href={`/profile/${player.id}?tab=preferences`} className="mb-6 block">
      <Card className="border-green-300 transition-colors hover:border-green-500 dark:border-green-800">
        <CardContent className="flex items-center gap-3 p-4">
          <Heart className="h-8 w-8 shrink-0 text-green-600" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t("prefs.nudgeTitle")}</p>
            <p className="text-sm text-muted-foreground">
              {count === 0 ? t("prefs.bannerEmpty") : t("prefs.bannerCount", { count })}
            </p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  )
}
