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
import { Loader2, Landmark } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import {
  listUnmatchedBankPayments,
  listUnpaidPlayers,
  linkBankPayment,
  type UnmatchedPayment,
  type UnpaidPlayerOption,
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

  const load = async () => {
    setLoading(true)
    const [p, u] = await Promise.all([listUnmatchedBankPayments(), listUnpaidPlayers()])
    setPayments(p)
    setPlayers(u)
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
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
