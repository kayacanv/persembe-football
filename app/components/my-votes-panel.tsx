"use client"

// "Oylarım" tab on someone else's profile: the viewer's own 8 values for this
// player, editable. Only the viewer ever sees it.

import { useState } from "react"
import { Loader2, Lock, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { saveRating } from "@/app/actions/rating-actions"
import { RATING_STATS, isCompleteRating, type MyRating, type StatValues } from "@/app/lib/rating-stats"
import { StatRatingForm, type DraftValues } from "@/app/components/stat-rating-form"
import { useTranslation } from "@/lib/i18n/useTranslation"

export function MyVotesPanel({
  targetId,
  targetName,
  initialValues,
  mine,
  onSaved,
}: {
  targetId: string
  targetName: string
  initialValues: StatValues | null
  mine: MyRating[]
  onSaved: (values: StatValues) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<DraftValues>(initialValues ?? {})
  const [saving, setSaving] = useState(false)

  const answered = RATING_STATS.filter((s) => draft[s] !== undefined).length
  const unchanged = !!initialValues && RATING_STATS.every((s) => draft[s] === initialValues[s])

  const handleSave = async () => {
    if (!isCompleteRating(draft)) return
    setSaving(true)
    try {
      const { ok } = await saveRating(targetId, draft)
      if (!ok) throw new Error("not saved")
      onSaved(draft)
      toast({ title: t("common.success"), description: t("rate.saved") })
    } catch {
      toast({ title: t("common.error"), description: t("rate.saveError"), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("rate.myVotesTitle")}</CardTitle>
        <CardDescription>
          {initialValues ? t("rate.myVotesDesc", { name: targetName }) : t("rate.myVotesEmpty", { name: targetName })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatRatingForm
          targetId={targetId}
          values={draft}
          onChange={(stat, value) => setDraft((d) => ({ ...d, [stat]: value }))}
          mine={mine}
          disabled={saving}
        />
        <Button
          onClick={handleSave}
          disabled={saving || answered < RATING_STATS.length || unchanged}
          className="w-full"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : answered < RATING_STATS.length ? (
            t("rate.answered", { count: answered, total: RATING_STATS.length })
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" /> {t("common.save")}
            </>
          )}
        </Button>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3 shrink-0" /> {t("rate.privacy")}
        </p>
      </CardContent>
    </Card>
  )
}
