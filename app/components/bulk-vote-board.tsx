"use client"

// Bulk voting board (/bulk-vote?attribute=…): one attribute for every player at
// once. Players start in the "not voted" pool; drag one into a score box, or tap
// the player and then the box. Every move saves straight away, one stat at a
// time, and dropping a player back in the pool removes that vote. Same players
// and order as /oyla. Votes are private — see app/actions/rating-actions.ts.

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { ArrowLeft, ArrowRight, Check, Info, Loader2, Lock, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { getRatingQueue, saveStatVote, type QueuePlayer, type RatingQueue } from "@/app/actions/rating-actions"
import {
  RATING_STATS,
  RATING_VALUES,
  STAT_SLUGS,
  type RatingStat,
  type RatingValue,
  type StatValues,
} from "@/app/lib/rating-stats"
import { useCurrentPlayer } from "@/app/lib/use-current-player"
import { useTranslation } from "@/lib/i18n/useTranslation"

// Highest score on top, like a tier list.
const BOXES = [...RATING_VALUES].reverse()

const BOX_COLOR: Record<RatingValue, string> = {
  99: "bg-emerald-600 text-white",
  95: "bg-emerald-500 text-white",
  90: "bg-lime-500 text-lime-950",
  85: "bg-yellow-400 text-yellow-950",
  80: "bg-amber-400 text-amber-950",
  70: "bg-orange-400 text-orange-950",
  60: "bg-red-400 text-red-950",
}

// What a drop zone sets the stat to; null (the pool) removes the vote.
type DropData = { value: RatingValue | null }

// The box under the pointer; between boxes, the one the chip overlaps most.
const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  return within.length > 0 ? within : rectIntersection(args)
}

const hrefFor = (stat: RatingStat) => `/bulk-vote?attribute=${STAT_SLUGS[stat]}`

function withValue(values: Partial<StatValues>, stat: RatingStat, value: RatingValue | null): Partial<StatValues> {
  const next = { ...values }
  if (value === null) delete next[stat]
  else next[stat] = value
  return next
}

export function BulkVoteBoard({ stat }: { stat: RatingStat }) {
  const { t } = useTranslation()
  const { player: me, loading: meLoading } = useCurrentPlayer()

  const [data, setData] = useState<RatingQueue | null>(null)
  const [loading, setLoading] = useState(true)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  // Tap-to-place: a tapped player goes into the next tapped box.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const navRef = useRef<HTMLElement>(null)

  // Mouse drags after a few pixels; touch after a short hold, so a swipe still scrolls.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

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

  // New attribute: drop the selection and bring its tab into view.
  useEffect(() => {
    setSelectedId(null)
    const nav = navRef.current
    const tab = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (nav && tab) nav.scrollLeft = tab.offsetLeft - (nav.clientWidth - tab.offsetWidth) / 2
  }, [stat, loading])

  const queue = data?.queue ?? []
  const pool = queue.filter((p) => p.values[stat] === undefined)
  const voted = queue.length - pool.length
  const selected = queue.find((p) => p.id === selectedId) ?? null
  const dragging = queue.find((p) => p.id === draggingId) ?? null
  // The player in hand already has a vote, so the pool would remove it.
  const removing = (dragging ?? selected)?.values[stat] !== undefined

  const index = RATING_STATS.indexOf(stat)
  const prevStat = RATING_STATS[index - 1]
  const nextStat = RATING_STATS[index + 1]
  const label = (s: RatingStat) => t(`rate.stats.${s}.label`)

  // Optimistic: move the chip now, save in the background, reload on failure.
  const place = async (id: string, value: RatingValue | null) => {
    setSelectedId(null)
    const target = queue.find((p) => p.id === id)
    if (!target || (target.values[stat] ?? null) === value) return

    setData(
      (d) =>
        d && {
          ...d,
          queue: d.queue.map((p) => (p.id === id ? { ...p, values: withValue(p.values, stat, value) } : p)),
        },
    )
    const { ok } = await saveStatVote(id, stat, value).catch(() => ({ ok: false }))
    if (!ok) {
      toast({ title: t("common.error"), description: t("bulk.saveError"), variant: "destructive" })
      getRatingQueue()
        .then((q) => q && setData(q))
        .catch((error) => console.error("Error reloading rating queue:", error))
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingId(String(event.active.id))
    setSelectedId(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingId(null)
    const drop = event.over?.data.current as DropData | undefined
    if (drop) place(String(event.active.id), drop.value)
  }

  const tapPlayer = (id: string) => setSelectedId((current) => (current === id ? null : id))
  const tapZone = (value: RatingValue | null) => {
    if (selectedId) place(selectedId, value)
  }

  const chip = (p: QueuePlayer) => (
    <PlayerChip key={p.id} player={p} selected={p.id === selectedId} onTap={() => tapPlayer(p.id)} />
  )

  const header = (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h1 className="text-2xl font-bold">{t("bulk.title")}</h1>
      <Link href="/oyla">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("common.back")}
        </Button>
      </Link>
    </div>
  )

  if (meLoading || loading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        {header}
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!me) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
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
      <div className="container mx-auto max-w-2xl px-4 py-8">
        {header}
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">{t("rate.empty")}</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      {header}

      {/* One page per attribute; a tick once every player has a vote for it. */}
      <nav ref={navRef} className="relative -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {RATING_STATS.map((s) => {
          const active = s === stat
          const done = queue.every((p) => p.values[s] !== undefined)
          return (
            <Link
              key={s}
              href={hrefFor(s)}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {done && <Check className="h-3.5 w-3.5" />}
              {label(s)}
            </Link>
          )
        })}
      </nav>

      <p className="text-lg font-semibold">
        {label(stat)}{" "}
        <span className="text-sm font-normal text-muted-foreground">· {t(`rate.stats.${stat}.hint`)}</span>
      </p>
      <p className="mb-1 text-xs text-muted-foreground">{t("bulk.howTo")}</p>

      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        <PoolZone
          done={voted}
          total={queue.length}
          removing={removing}
          selecting={!!selected}
          onTap={() => tapZone(null)}
          empty={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{t("bulk.poolDone", { stat: label(stat) })}</span>
              {nextStat && (
                <Link
                  href={hrefFor(nextStat)}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2"
                >
                  {t("bulk.next", { stat: label(nextStat) })}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </span>
          }
        >
          {pool.map(chip)}
        </PoolZone>

        <div className="space-y-2">
          {BOXES.map((value) => {
            const players = queue.filter((p) => p.values[stat] === value)
            return (
              <ValueBox key={value} value={value} selecting={!!selected} onTap={() => tapZone(value)}>
                {players.length > 0 ? (
                  players.map(chip)
                ) : (
                  <span className="px-1 text-xs text-muted-foreground">
                    {selected ? t("bulk.placeHere") : t("bulk.dropHere")}
                  </span>
                )}
              </ValueBox>
            )
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {dragging ? <ChipBody player={dragging} className="cursor-grabbing shadow-lg ring-2 ring-primary" /> : null}
        </DragOverlay>
      </DndContext>

      <div className="mt-4 space-y-1 text-xs text-muted-foreground">
        <p className="flex items-center gap-1">
          <Info className="h-3 w-3 shrink-0" /> {t("bulk.countNote")}
        </p>
        <p className="flex items-center gap-1">
          <Lock className="h-3 w-3 shrink-0" /> {t("rate.privacy")}
        </p>
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
        {prevStat && (
          <Button asChild variant="outline" className="sm:flex-1">
            <Link href={hrefFor(prevStat)}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t("bulk.prev", { stat: label(prevStat) })}
            </Link>
          </Button>
        )}
        {nextStat && (
          <Button asChild className="sm:flex-1">
            <Link href={hrefFor(nextStat)}>
              {t("bulk.next", { stat: label(nextStat) })}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
      <Toaster />
    </div>
  )
}

// The players without a vote on this attribute. Sticky, so a chip can be dragged
// down to any box; dropping a voted player here removes the vote.
function PoolZone({
  done,
  total,
  removing,
  selecting,
  onTap,
  empty,
  children,
}: {
  done: number
  total: number
  removing: boolean
  selecting: boolean
  onTap: () => void
  empty: ReactNode
  children: ReactNode[]
}) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({ id: "pool", data: { value: null } satisfies DropData })

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-2 bg-background/95 px-4 py-2 backdrop-blur">
      <div
        ref={setNodeRef}
        onClick={onTap}
        className={`rounded-lg border p-2 transition-colors ${
          isOver ? "border-primary bg-primary/5" : removing && selecting ? "cursor-pointer border-dashed border-primary/60" : ""
        }`}
      >
        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold">{t("bulk.pool")}</span>
          <span className="tabular-nums text-muted-foreground">{t("bulk.progress", { done, total })}</span>
        </div>
        <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
        {removing && <p className="mb-1.5 text-xs font-medium text-primary">{t("bulk.removeHere")}</p>}
        {children.length > 0 ? (
          // About two and a half rows on a phone, so the boxes stay in view.
          <div className="flex max-h-[5.5rem] flex-wrap gap-1.5 overflow-y-auto sm:max-h-[30vh]">{children}</div>
        ) : (
          !removing && <div className="text-xs text-muted-foreground">{empty}</div>
        )}
      </div>
    </div>
  )
}

// One score box: the coloured score on the left, its players on the right.
function ValueBox({
  value,
  selecting,
  onTap,
  children,
}: {
  value: RatingValue
  selecting: boolean
  onTap: () => void
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `value-${value}`, data: { value } satisfies DropData })

  return (
    <div
      ref={setNodeRef}
      onClick={onTap}
      className={`flex gap-2 rounded-lg border p-1.5 transition-colors ${
        isOver ? "border-primary bg-primary/5" : selecting ? "cursor-pointer border-dashed border-primary/60 hover:bg-muted" : ""
      }`}
    >
      <button
        type="button"
        disabled={!selecting}
        onClick={(e) => {
          e.stopPropagation()
          onTap()
        }}
        className={`flex min-h-10 w-12 shrink-0 items-center justify-center rounded-md text-lg font-bold tabular-nums ${
          selecting ? "cursor-pointer" : ""
        } ${BOX_COLOR[value]}`}
      >
        {value}
      </button>
      <div className="flex min-w-0 flex-1 flex-wrap content-center items-center gap-1.5">{children}</div>
    </div>
  )
}

// A draggable player. Tapping selects it for tap-to-place instead.
function PlayerChip({ player, selected, onTap }: { player: QueuePlayer; selected: boolean; onTap: () => void }) {
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: player.id })

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      aria-pressed={selected}
      onClick={(e) => {
        e.stopPropagation()
        onTap()
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={`max-w-full cursor-grab select-none rounded-full [-webkit-touch-callout:none] active:cursor-grabbing ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <ChipBody
        player={player}
        className={selected ? "border-primary ring-2 ring-primary" : "shadow-sm hover:bg-muted"}
      />
    </button>
  )
}

function ChipBody({ player, className = "" }: { player: QueuePlayer; className?: string }) {
  return (
    <span
      className={`flex max-w-[11rem] items-center gap-1.5 rounded-full border bg-background py-0.5 pl-0.5 pr-2.5 text-sm ${className}`}
    >
      {player.photo_url ? (
        <img
          src={player.photo_url}
          alt=""
          draggable={false}
          className="pointer-events-none h-6 w-6 shrink-0 rounded-full bg-muted object-cover object-top"
        />
      ) : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          {player.name.charAt(0).toLocaleUpperCase()}
        </span>
      )}
      <span className="truncate font-medium">{player.name}</span>
    </span>
  )
}
