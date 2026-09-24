"use client"

// Player rating page (plan-ratings.md). One player per screen, all 8 stats on
// one scrolling screen; every stat must be answered before saving, but the
// whole player can be skipped. The queue starts with the players you played
// with most. Votes are private — see app/actions/rating-actions.ts.

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Loader2, Lock, LogIn, SkipForward, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import {
  getRatingQueue,
  saveRating,
  skipRating,
  type QueuePlayer,
  type RatingQueue,
} from "@/app/actions/rating-actions"
import { RATING_STATS, isCompleteRating, type MyRating } from "@/app/lib/rating-stats"
import { StatRatingForm, type DraftValues } from "@/app/components/stat-rating-form"
import { useCurrentPlayer } from "@/app/lib/use-current-player"
import { useTranslation } from "@/lib/i18n/useTranslation"

export default function RatePage() {
  const { t } = useTranslation()
  const { player: me, loading: meLoading } = useCurrentPlayer()

  const [data, setData] = useState<RatingQueue | null>(null)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<DraftValues>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (meLoading) return
    if (!me) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    getRatingQueue()
      .then((q) => active && setData(q))
      .catch((error) => console.error("Error loading rating queue:", error))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [me?.id, meLoading])

  const queue = data?.queue ?? []
  const current = queue.find((p) => p.status !== "rated") ?? null
  const ratedCount = queue.filter((p) => p.status === "rated").length
  const answered = RATING_STATS.filter((s) => draft[s] !== undefined).length

  // Fresh form for each player.
  useEffect(() => {
    setDraft({})
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [current?.id])

  const replaceMine = (mine: MyRating[], p: QueuePlayer, values: DraftValues): MyRating[] => [
    ...mine.filter((r) => r.targetId !== p.id),
    ...RATING_STATS.map((stat) => ({ targetId: p.id, name: p.name, stat, value: values[stat]! })),
  ]

  const handleSave = async () => {
    if (!current || !data || !isCompleteRating(draft)) return
    setBusy(true)
    try {
      const { ok } = await saveRating(current.id, draft)
      if (!ok) throw new Error("not saved")
      setData({
        queue: data.queue.map((p) => (p.id === current.id ? { ...p, status: "rated", values: draft } : p)),
        mine: replaceMine(data.mine, current, draft),
      })
    } catch {
      toast({ title: t("common.error"), description: t("rate.saveError"), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  // Skipped players go behind the unrated ones (before the rated ones).
  const handleSkip = async () => {
    if (!current || !data) return
    setBusy(true)
    try {
      await skipRating(current.id)
      const rest = data.queue.filter((p) => p.id !== current.id)
      const firstRated = rest.findIndex((p) => p.status === "rated")
      const at = firstRated === -1 ? rest.length : firstRated
      rest.splice(at, 0, { ...current, status: "skipped" })
      setData({ ...data, queue: rest })
    } finally {
      setBusy(false)
    }
  }

  const header = (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h1 className="text-2xl font-bold">{t("rate.title")}</h1>
      <Link href="/">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("common.back")}
        </Button>
      </Link>
    </div>
  )

  const privacy = (
    <p className="flex items-center gap-1 text-xs text-muted-foreground">
      <Lock className="h-3 w-3 shrink-0" /> {t("rate.privacy")}
    </p>
  )

  if (meLoading || loading) {
    return (
      <div className="container mx-auto max-w-md px-4 py-8">
        {header}
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!me) {
    return (
      <div className="container mx-auto max-w-md px-4 py-8">
        {header}
        <Card>
          <CardContent className="space-y-4 p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("rate.signInNeeded")}</p>
            <Button asChild className="w-full">
              <Link href="/giris">
                <LogIn className="mr-2 h-4 w-4" />
                {t("auth.signIn")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="container mx-auto max-w-md px-4 py-8">
        {header}
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">{t("rate.empty")}</CardContent>
        </Card>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="container mx-auto max-w-md px-4 py-8">
        {header}
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-green-600" />
              <p className="font-semibold">{t("rate.allDone")}</p>
              <p className="text-sm text-muted-foreground">{t("rate.allDoneDesc")}</p>
            </div>
            <div className="space-y-2">
              {queue.map((p) => (
                <Link
                  key={p.id}
                  href={`/profile/${p.id}?tab=myvotes`}
                  className="flex items-center justify-between rounded-md border p-2 text-sm hover:bg-muted"
                >
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{t("rate.edit")}</span>
                </Link>
              ))}
            </div>
            {privacy}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-md px-4 pt-8 pb-4">
      {header}

      <div className="mb-3">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>{t("rate.progress", { done: ratedCount, total: queue.length })}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${(ratedCount / queue.length) * 100}%` }}
          />
        </div>
      </div>

      <Card className="mb-3">
        <CardContent className="flex items-center gap-3 p-3">
          {current.photo_url ? (
            <img
              src={current.photo_url}
              alt=""
              className="h-14 w-14 shrink-0 rounded-full bg-muted object-cover object-top"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold">
              {current.name.charAt(0).toLocaleUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{current.name}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {current.card_position && <span className="font-medium">{current.card_position} · </span>}
              <Users className="h-3 w-3" /> {t("rate.sharedMatches", { count: current.shared })}
            </p>
          </div>
        </CardContent>
      </Card>

      <StatRatingForm
        targetId={current.id}
        values={draft}
        onChange={(stat, value) => setDraft((d) => ({ ...d, [stat]: value }))}
        mine={data?.mine ?? []}
        disabled={busy}
      />

      <div className="mt-3">{privacy}</div>

      {/* Sticky action bar so Save is always reachable on a phone. */}
      <div className="sticky bottom-0 -mx-4 mt-3 flex gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <Button variant="outline" onClick={handleSkip} disabled={busy} className="shrink-0">
          <SkipForward className="mr-1 h-4 w-4" />
          {t("rate.skip")}
        </Button>
        <Button onClick={handleSave} disabled={busy || answered < RATING_STATS.length} className="flex-1">
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : answered < RATING_STATS.length ? (
            t("rate.answered", { count: answered, total: RATING_STATS.length })
          ) : (
            t("rate.saveNext")
          )}
        </Button>
      </div>
      <Toaster />
    </div>
  )
}
