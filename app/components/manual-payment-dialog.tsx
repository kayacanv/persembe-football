"use client"

// Admin dialog on a finished match: mark a registration paid by hand, with a
// note ("sent to my Revolut"), or edit / undo an earlier hand mark.
// Server side: app/actions/manual-payment-actions.ts.

import { useEffect, useState } from "react"
import { HandCoins, Loader2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { markPaidManually, undoManualPayment, type ManualPayment } from "@/app/actions/manual-payment-actions"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { formatRelativeTime } from "@/lib/i18n/format"

// Same limit as manual-payment-actions.ts and the check in add-manual-payments.sql.
const MAX_NOTE_LENGTH = 200

type ManualPaymentDialogProps = {
  // The registration being marked; null closes the dialog.
  player: { name: string; match_player_id: string } | null
  existing: ManualPayment | null
  price: number
  onClose: () => void
  onMarked: (payment: ManualPayment) => void
  onUndone: (matchPlayerId: string) => void
}

export function ManualPaymentDialog({ player, existing, price, onClose, onMarked, onUndone }: ManualPaymentDialogProps) {
  const { t, locale } = useTranslation()
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [confirmUndo, setConfirmUndo] = useState(false)
  const busy = saving || undoing

  // A fresh form every time the dialog opens for someone.
  useEffect(() => {
    setNote(existing?.note ?? "")
    setConfirmUndo(false)
  }, [player?.match_player_id, existing])

  const showError = (reason: string) =>
    toast({
      title: t("common.error"),
      description: reason === "forbidden" ? t("manualPay.forbidden") : t("manualPay.failed"),
      variant: "destructive",
    })

  const handleSave = async () => {
    if (!player) return
    setSaving(true)
    try {
      const result = await markPaidManually(player.match_player_id, note)
      if (!result.ok) {
        showError(result.reason)
        return
      }
      toast({ title: existing ? t("manualPay.noteSaved") : t("manualPay.marked"), description: player.name })
      onMarked(result.payment)
    } catch (error) {
      console.error("Error marking paid manually:", error)
      showError("error")
    } finally {
      setSaving(false)
    }
  }

  // Two taps, like the kumbara's manual delete: the first only arms it.
  const handleUndo = async () => {
    if (!player) return
    if (!confirmUndo) {
      setConfirmUndo(true)
      return
    }
    setUndoing(true)
    try {
      const result = await undoManualPayment(player.match_player_id)
      if (!result.ok) {
        showError(result.reason)
        return
      }
      toast({ title: t("manualPay.undone"), description: player.name })
      onUndone(player.match_player_id)
    } catch (error) {
      console.error("Error undoing manual payment:", error)
      showError("error")
    } finally {
      setUndoing(false)
      setConfirmUndo(false)
    }
  }

  return (
    <Dialog open={player !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? t("manualPay.editTitle") : t("manualPay.title")}</DialogTitle>
          <DialogDescription>
            {t("manualPay.desc", { name: player?.name ?? "", price: price.toFixed(2) })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {existing && (
            <p className="text-xs text-muted-foreground">
              {existing.marked_by_name
                ? t("manualPay.markedInfo", {
                    name: existing.marked_by_name,
                    date: formatRelativeTime(existing.marked_at, locale),
                  })
                : t("manualPay.markedInfoNoName", { date: formatRelativeTime(existing.marked_at, locale) })}
            </p>
          )}
          <Label htmlFor="manual-payment-note">{t("manualPay.noteLabel")}</Label>
          <Textarea
            id="manual-payment-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={MAX_NOTE_LENGTH}
            placeholder={t("manualPay.notePlaceholder")}
            rows={2}
            className="min-h-0"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {existing && (
            <Button variant="outline" className="text-destructive sm:mr-auto" onClick={handleUndo} disabled={busy}>
              {undoing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
              {confirmUndo ? t("manualPay.undoConfirm") : t("manualPay.undo")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={busy} className="bg-green-600 hover:bg-green-700">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.saving")}
              </>
            ) : (
              <>
                <HandCoins className="mr-2 h-4 w-4" /> {existing ? t("manualPay.saveNote") : t("manualPay.save")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ManualPaymentDialog
