"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  PiggyBank as PiggyIcon,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Toaster } from "@/components/ui/toaster"
import { toast } from "@/components/ui/use-toast"
import { PiggyBank } from "@/app/components/piggy-bank"
import { LanguageSwitcher } from "@/app/components/language-switcher"
import { ACTIVE_PIGGY } from "@/app/config/piggy"
import { formatPounds, getPiggyTotals, type PiggyContribution } from "@/app/lib/piggy-service"
import {
  addManualContribution,
  deleteManualContribution,
  listManualContributions,
  type ManualContribution,
} from "@/app/actions/piggy-actions"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { formatRelativeTime } from "@/lib/i18n/format"

// How often the wall re-checks for new money. Transfers arrive by webhook within
// seconds, so this only decides how fast they appear on an already-open page.
const POLL_MS = 15_000

// The progress bar is drawn as discrete coin slots — easier to read at a glance
// on a phone than a smooth bar.
const COIN_SLOTS = 17

export default function KumbaraPage() {
  const { t, locale } = useTranslation()
  const searchParams = useSearchParams()
  const isAdmin = searchParams.get("admin") === "true"

  const [contributions, setContributions] = useState<PiggyContribution[]>([])
  const [collected, setCollected] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [amountMinor, setAmountMinor] = useState<number>(ACTIVE_PIGGY.amountPresets[0])
  const [customAmount, setCustomAmount] = useState("")

  // Bumped whenever the collected total grows, so the pig drops a coin.
  const [coinTrigger, setCoinTrigger] = useState(0)
  const lastCollected = useRef<number | null>(null)

  // Admin-only (?admin=true): hand-typed contributions for money that never
  // touches the Starling feed (Revolut, cash).
  const [manual, setManual] = useState<ManualContribution[]>([])
  const [manualName, setManualName] = useState("")
  const [manualAmount, setManualAmount] = useState("")
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    const totals = await getPiggyTotals()
    setContributions(totals.contributions)
    setCollected(totals.collectedMinor)

    if (lastCollected.current !== null && totals.collectedMinor > lastCollected.current) {
      setCoinTrigger((c) => c + 1)
    }
    lastCollected.current = totals.collectedMinor

    setLoading(false)
    setRefreshing(false)
  }, [])

  const loadManual = useCallback(async () => {
    setManual(await listManualContributions())
  }, [])

  useEffect(() => {
    if (isAdmin) loadManual()
  }, [isAdmin, loadManual])

  useEffect(() => {
    load()
    const id = window.setInterval(load, POLL_MS)
    // Coming back to the tab should feel instant rather than waiting out the poll.
    const onFocus = () => load()
    window.addEventListener("focus", onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener("focus", onFocus)
    }
  }, [load])

  const goal = ACTIVE_PIGGY.goalMinor
  const remaining = Math.max(0, goal - collected)
  const progress = goal > 0 ? Math.min(1, collected / goal) : 0
  const reached = collected >= goal

  const settleUpHref = `${ACTIVE_PIGGY.settleUpUrl}?amount=${(amountMinor / 100).toFixed(2)}`

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast({ title: t("common.copied"), description: t("common.copySuccess", { label }) })
    } catch {
      toast({ title: t("common.error"), variant: "destructive" })
    }
  }

  const onCustomAmount = (raw: string) => {
    setCustomAmount(raw)
    const parsed = Number.parseFloat(raw.replace(",", "."))
    if (Number.isFinite(parsed) && parsed > 0) {
      setAmountMinor(Math.round(parsed * 100))
    }
  }

  const parsedManualMinor = (() => {
    const parsed = Number.parseFloat(manualAmount.replace(",", "."))
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0
  })()

  const handleManualAdd = async () => {
    const name = manualName.trim()
    if (!name || parsedManualMinor <= 0) {
      toast({ title: t("common.error"), description: t("piggy.adminInvalid"), variant: "destructive" })
      return
    }

    setAdding(true)
    const { success, error } = await addManualContribution(name, parsedManualMinor)
    setAdding(false)

    if (!success) {
      toast({
        title: t("common.error"),
        description: error || t("piggy.adminAddFailed"),
        variant: "destructive",
      })
      return
    }

    toast({
      title: t("piggy.adminAdded"),
      description: t("piggy.adminAddedDesc", { name, amount: formatPounds(parsedManualMinor) }),
    })
    setManualName("")
    setManualAmount("")
    await Promise.all([load(true), loadManual()])
  }

  const handleManualDelete = async (id: string) => {
    setDeleting(id)
    const { success, error } = await deleteManualContribution(id)
    setDeleting(null)
    setConfirmDelete(null)

    if (!success) {
      toast({
        title: t("common.error"),
        description: error || t("piggy.adminDeleteFailed"),
        variant: "destructive",
      })
      return
    }

    toast({ title: t("piggy.adminDeleted"), description: t("piggy.adminDeletedDesc") })
    await Promise.all([load(true), loadManual()])
  }

  const bankRows: { label: string; value: string; copy?: boolean }[] = [
    { label: t("payment.starlingAccountName"), value: process.env.NEXT_PUBLIC_STARLING_ACCOUNT_NAME || "—" },
    { label: t("payment.starlingSortCode"), value: process.env.NEXT_PUBLIC_STARLING_SORT_CODE || "—" },
    {
      label: t("payment.starlingAccountNumber"),
      value: process.env.NEXT_PUBLIC_STARLING_ACCOUNT_NUMBER || "—",
      copy: true,
    },
    { label: t("payment.starlingReference"), value: ACTIVE_PIGGY.refCode, copy: true },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-background to-background dark:from-pink-950/30">
      <Toaster />
      {reached && <Confetti />}

      <div className="mx-auto w-full max-w-md px-4 pb-28 pt-4">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="-ml-2">
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t("common.back")}
            </Button>
          </Link>
          <LanguageSwitcher />
        </div>

        <div className="mb-2 text-center">
          <h1 className="flex items-center justify-center gap-2 text-2xl font-bold">
            <PiggyIcon className="h-6 w-6 text-pink-500" />
            {t("piggy.title")}
          </h1>
          <p className="text-sm font-medium text-pink-600 dark:text-pink-400">{t("piggy.tagline")}</p>
        </div>

        <PiggyBank progress={progress} coinTrigger={coinTrigger} className="mx-auto w-full max-w-[280px]" />

        {/* The number that matters, as big as it can reasonably get. */}
        <div className="mt-1 text-center">
          {loading ? (
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-muted-foreground" />
          ) : reached ? (
            <p className="text-2xl font-bold text-green-600">{t("piggy.goalReached")}</p>
          ) : (
            <>
              <p className="text-5xl font-extrabold tracking-tight text-pink-600 dark:text-pink-400">
                {formatPounds(remaining)}
              </p>
              <p className="text-lg font-semibold text-muted-foreground">{t("piggy.remaining")}</p>
            </>
          )}
        </div>

        {/* 17 coin slots — one per £10 of the target. */}
        <div className="mt-4 flex justify-center gap-1" aria-hidden>
          {Array.from({ length: COIN_SLOTS }).map((_, i) => {
            const slotFill = Math.max(0, Math.min(1, progress * COIN_SLOTS - i))
            return (
              <div
                key={i}
                className="h-3 flex-1 overflow-hidden rounded-full bg-pink-200 dark:bg-pink-950"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-[width] duration-700"
                  style={{ width: `${slotFill * 100}%` }}
                />
              </div>
            )
          })}
        </div>

        <p className="mt-2 text-center text-sm text-muted-foreground">
          {t("piggy.collectedOf", { collected: formatPounds(collected), goal: formatPounds(goal) })}
        </p>

        {/* Contributor wall */}
        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">
              {t("piggy.heroes")}
              {contributions.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {t("piggy.heroCount", { count: contributions.length })}
                </span>
              )}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : contributions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("piggy.noContributions")}
            </p>
          ) : (
            <div className="space-y-2">
              {/* Names only — who chipped in is public, how much they gave is not. */}
              {contributions.map((c) => {
                const name = c.display_name?.trim() || t("piggy.anonymous")
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 font-bold text-amber-900">
                      {name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatRelativeTime(c.paid_at, locale)}
                      </p>
                    </div>
                    <Check className="h-5 w-5 shrink-0 text-green-600" />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Manual add — ?admin=true only. Revolut and cash never reach the bank
            feed, so they get typed in by hand. */}
        {isAdmin && (
          <div className="mt-8 rounded-lg border border-dashed border-pink-300 bg-pink-50/60 p-4 dark:border-pink-900 dark:bg-pink-950/20">
            <h2 className="flex items-center gap-2 font-semibold">
              <Plus className="h-4 w-4 text-pink-600" />
              {t("piggy.adminTitle")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("piggy.adminDesc")}</p>

            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="manual-name" className="text-xs">
                  {t("piggy.adminWhoPaid")}
                </Label>
                <Input
                  id="manual-name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder={t("common.namePlaceholder")}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="manual-amount" className="text-xs">
                  {t("piggy.adminAmount")}
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-muted-foreground">£</span>
                  <Input
                    id="manual-amount"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.5"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    placeholder="10"
                  />
                </div>
              </div>

              <Button
                className="h-11 w-full bg-pink-600 font-semibold hover:bg-pink-700"
                onClick={handleManualAdd}
                disabled={adding || !manualName.trim() || parsedManualMinor <= 0}
              >
                {adding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {t("piggy.adminAdd")}
              </Button>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t("piggy.adminManualList")}
              </p>
              {manual.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("piggy.adminNoManual")}</p>
              ) : (
                <div className="space-y-2">
                  {manual.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 rounded-md border bg-background p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {m.display_name?.trim() || t("piggy.anonymous")}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatRelativeTime(m.paid_at, locale)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold">
                        {formatPounds(m.amount_minor)}
                      </span>
                      {confirmDelete === m.id ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 shrink-0"
                          onClick={() => handleManualDelete(m.id)}
                          disabled={deleting === m.id}
                        >
                          {deleting === m.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            t("piggy.adminConfirmDelete")
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground"
                          onClick={() => setConfirmDelete(m.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">{t("piggy.autoNote")}</p>
      </div>

      {/* Sticky CTA — always within thumb reach. */}
      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto w-full max-w-md">
          <Button
            className="h-12 w-full bg-pink-600 text-base font-semibold hover:bg-pink-700"
            onClick={() => setPayOpen(true)}
          >
            <PiggyIcon className="mr-2 h-5 w-5" />
            {reached ? t("piggy.ctaAfterGoal") : t("piggy.cta")}
          </Button>
        </div>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("piggy.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("piggy.dialogDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">{t("piggy.amountLabel")}</p>
              <div className="grid grid-cols-2 gap-2">
                {ACTIVE_PIGGY.amountPresets.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={amountMinor === preset ? "default" : "outline"}
                    onClick={() => {
                      setAmountMinor(preset)
                      setCustomAmount("")
                    }}
                    className={amountMinor === preset ? "bg-pink-600 hover:bg-pink-700" : ""}
                  >
                    {formatPounds(preset)}
                  </Button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-lg font-semibold text-muted-foreground">£</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="0.5"
                  placeholder={t("piggy.customAmount")}
                  value={customAmount}
                  onChange={(e) => onCustomAmount(e.target.value)}
                />
              </div>
            </div>

            <Button
              className="h-12 w-full bg-blue-600 text-base hover:bg-blue-700"
              disabled={amountMinor <= 0}
              onClick={() => window.open(settleUpHref, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="mr-2 h-5 w-5" />
              {t("piggy.payButton", { amount: formatPounds(amountMinor) })}
            </Button>

            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {t("piggy.refReminder", { ref: ACTIVE_PIGGY.refCode })}
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">{t("piggy.manualTransfer")}</p>
              <div className="space-y-2">
                {bankRows.map((r) => (
                  <div
                    key={r.label}
                    className="flex items-center justify-between gap-2 rounded-md border bg-background p-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{r.label}</p>
                      <p className="truncate font-mono text-sm font-medium">{r.value}</p>
                    </div>
                    {r.copy && r.value !== "—" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => copy(r.value, r.label)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Cheap one-shot confetti for hitting the target. Positions are deterministic so
// server and client markup agree.
function Confetti() {
  const colors = ["#F59E0B", "#EC4899", "#22C55E", "#3B82F6", "#FDE68A"]
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {Array.from({ length: 40 }).map((_, i) => (
        <span
          key={i}
          className="piggy-confetti-piece"
          style={{
            left: `${(i * 37) % 100}%`,
            backgroundColor: colors[i % colors.length],
            animationDuration: `${3 + ((i * 7) % 20) / 10}s`,
            animationDelay: `${((i * 13) % 30) / 10}s`,
          }}
        />
      ))}
    </div>
  )
}
