"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronDown, ChevronUp, Loader2, Landmark, PiggyBank, Sparkles, Trash2, Users } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import {
  listUnmatchedBankPayments,
  listUnpaidPlayers,
  linkBankPayment,
  assignBankPaymentToPiggy,
  listPayerAliases,
  deletePayerAlias,
  type UnmatchedPayment,
  type UnpaidPlayerOption,
  type PayerAliasAdminRow,
} from "@/app/actions/starling-actions"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { formatFullDate } from "@/lib/i18n/format"

export default function StarlingReconcilePage() {
  const { t, locale } = useTranslation()
  const searchParams = useSearchParams()
  const isAdmin = searchParams.get("admin") === "true"

  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<UnmatchedPayment[]>([])
  const [players, setPlayers] = useState<UnpaidPlayerOption[]>([])
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [linking, setLinking] = useState<string | null>(null)
  const [assigning, setAssigning] = useState<string | null>(null)

  // Learned payer-name -> player pairs. Collapsed by default; this is the
  // admin's only tool for undoing a wrong auto-learned pair.
  const [aliases, setAliases] = useState<PayerAliasAdminRow[]>([])
  const [showAliases, setShowAliases] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const [p, u, a] = await Promise.all([listUnmatchedBankPayments(), listUnpaidPlayers(), listPayerAliases()])
    setPayments(p)
    setPlayers(u)
    setAliases(a)
    // Pre-select the one obvious candidate so a single tap on Link settles it.
    setSelected((prev) => {
      const next = { ...prev }
      for (const payment of p) {
        if (!next[payment.feed_item_uid] && payment.suggestions.length === 1) {
          next[payment.feed_item_uid] = payment.suggestions[0].match_player_id
        }
      }
      return next
    })
    setLoading(false)
  }

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        {t("admin.adminOnly")}
      </div>
    )
  }

  const handleLink = async (feedItemUid: string) => {
    const matchPlayerId = selected[feedItemUid]
    if (!matchPlayerId) {
      toast({ title: t("admin.selectPlayerTitle"), description: t("admin.selectPlayerDesc") })
      return
    }
    setLinking(feedItemUid)
    const { success, error } = await linkBankPayment(feedItemUid, matchPlayerId)
    setLinking(null)
    if (success) {
      toast({ title: t("admin.linked"), description: t("admin.linkSuccess") })
      await load()
    } else {
      toast({ title: t("common.error"), description: error || t("admin.linkFailed"), variant: "destructive" })
    }
  }

  const handleAssignToPiggy = async (feedItemUid: string) => {
    setAssigning(feedItemUid)
    const { success, error } = await assignBankPaymentToPiggy(feedItemUid)
    setAssigning(null)
    if (success) {
      toast({ title: t("admin.countedAsPiggy"), description: t("admin.countedAsPiggyDesc") })
      await load()
    } else {
      toast({ title: t("common.error"), description: error || t("admin.linkFailed"), variant: "destructive" })
    }
  }

  const handleDeleteAlias = async (aliasId: string) => {
    setDeletingId(aliasId)
    const { success, error } = await deletePayerAlias(aliasId)
    setDeletingId(null)
    setConfirmDeleteId(null)
    if (success) {
      setAliases((prev) => prev.filter((a) => a.id !== aliasId))
      toast({ title: t("admin.aliasDeleted") })
    } else {
      toast({ title: t("common.error"), description: error || t("admin.aliasDeleteFailed"), variant: "destructive" })
    }
  }

  // Group the alias list by bank name so one payer's several players sit together.
  const aliasGroups = aliases.reduce<Map<string, PayerAliasAdminRow[]>>((acc, row) => {
    acc.set(row.payer_key, [...(acc.get(row.payer_key) ?? []), row])
    return acc
  }, new Map())

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <Toaster />
      <div className="flex items-center gap-2">
        <Landmark className="h-5 w-5" />
        <h1 className="text-lg font-semibold">{t("admin.starlingUnmatched")}</h1>
      </div>

      <Button variant="outline" size="sm" onClick={load} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {t("common.refresh")}
      </Button>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : payments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {t("admin.noUnmatchedPayments")}
        </p>
      ) : (
        payments.map((p) => (
          <Card key={p.feed_item_uid}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="text-green-600">
                  £{(p.amount_minor / 100).toFixed(2)}
                </span>
                <span className="text-xs text-muted-foreground font-normal">
                  {formatFullDate(p.transaction_time, locale)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm">
                <p>
                  <span className="text-muted-foreground">{t("payment.sender")}</span>{" "}
                  {p.counterparty_name || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">{t("payment.description")}</span>{" "}
                  <span className="font-mono">{p.reference || "—"}</span>
                </p>
              </div>

              {/* Known payer: their open registrations that fit this amount and
                  date. One tap pre-selects the picker below. */}
              {p.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {p.suggestions.map((sg) => {
                    const active = selected[p.feed_item_uid] === sg.match_player_id
                    return (
                      <button
                        key={sg.match_player_id}
                        type="button"
                        onClick={() => setSelected((s) => ({ ...s, [p.feed_item_uid]: sg.match_player_id }))}
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
                          active
                            ? "border-green-600 bg-green-600 text-white"
                            : "bg-background text-foreground hover:bg-muted"
                        }`}
                      >
                        <Sparkles className="h-3 w-3" />
                        {t("admin.suggestion")}: {sg.name} — {sg.match_date} (£{sg.price.toFixed(2)})
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <Select
                  value={selected[p.feed_item_uid] ?? ""}
                  onValueChange={(v) => setSelected((s) => ({ ...s, [p.feed_item_uid]: v }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t("admin.selectPlayer")} />
                  </SelectTrigger>
                  <SelectContent>
                    {players.map((pl) => (
                      <SelectItem key={pl.match_player_id} value={pl.match_player_id}>
                        {pl.name} — {pl.match_date} (£{pl.price.toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => handleLink(p.feed_item_uid)}
                  disabled={linking === p.feed_item_uid}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {linking === p.feed_item_uid ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("admin.linkPayment")
                  )}
                </Button>
              </div>
              {/* Fallback for money sent without (or with a mistyped) campaign reference. */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleAssignToPiggy(p.feed_item_uid)}
                disabled={assigning === p.feed_item_uid}
              >
                {assigning === p.feed_item_uid ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <PiggyBank className="mr-2 h-4 w-4" /> {t("admin.countAsPiggy")}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))
      )}

      {/* Learned payer names. Linking a payment above adds to this list. */}
      <Card>
        <CardHeader className="pb-2">
          <button
            type="button"
            onClick={() => setShowAliases((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> {t("admin.knownPayers")}
              <span className="text-xs font-normal text-muted-foreground">({aliasGroups.size})</span>
            </CardTitle>
            {showAliases ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </CardHeader>
        {showAliases && (
          <CardContent className="space-y-3">
            {aliasGroups.size === 0 ? (
              <p className="text-sm text-muted-foreground">{t("admin.noKnownPayers")}</p>
            ) : (
              Array.from(aliasGroups.entries()).map(([key, rows]) => (
                <div key={key} className="rounded-md border p-2 space-y-1">
                  <p className="text-sm font-medium">{rows[0].payer_name}</p>
                  {rows.map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <span className="text-foreground">{row.user_name}</span>{" "}
                        <span className="text-muted-foreground">
                          · {t("admin.aliasRow", { count: row.match_count, date: formatFullDate(row.last_seen, locale) })}
                        </span>
                      </div>
                      {confirmDeleteId === row.id ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2"
                            onClick={() => handleDeleteAlias(row.id)}
                            disabled={deletingId === row.id}
                          >
                            {deletingId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : t("admin.aliasDeleteConfirm")}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setConfirmDeleteId(null)}>
                            {t("common.cancel")}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 shrink-0 px-2 text-muted-foreground"
                          onClick={() => setConfirmDeleteId(row.id)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" /> {t("admin.aliasDelete")}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}
