"use client"

// Teammate preferences UI: a 3-way toggle (want / ok / no preference), the
// owner's full list on their profile, and a single toggle card on someone
// else's profile. All data goes through app/actions/preference-actions.ts and
// is private to the signed-in player.

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Heart, Loader2, Lock, Search, ThumbsUp, Minus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import {
  getMyPreferenceFor,
  getMyTeammatePreferences,
  setTeammatePreference,
  type PreferenceCandidate,
  type TeammatePref,
} from "@/app/actions/preference-actions"
import { useTranslation } from "@/lib/i18n/useTranslation"

type Choice = TeammatePref | null

export function PreferenceToggle({
  value,
  onChange,
  disabled,
}: {
  value: Choice
  onChange: (next: Choice) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const options: { value: Choice; label: string; icon: typeof Heart; active: string }[] = [
    { value: "want", label: t("prefs.want"), icon: Heart, active: "bg-green-600 text-white border-green-600" },
    { value: "ok", label: t("prefs.ok"), icon: ThumbsUp, active: "bg-sky-600 text-white border-sky-600" },
    { value: null, label: t("prefs.none"), icon: Minus, active: "bg-muted text-foreground border-muted-foreground/30" },
  ]

  return (
    <div role="radiogroup" className="grid w-full grid-cols-3 gap-1">
      {options.map((o) => {
        const selected = value === o.value
        const Icon = o.icon
        return (
          <button
            key={o.value ?? "none"}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => !selected && onChange(o.value)}
            className={`flex h-9 items-center justify-center gap-1 rounded-md border px-1 text-xs font-medium transition-colors disabled:opacity-60 ${
              selected ? o.active : "bg-background text-muted-foreground"
            }`}
          >
            <Icon className={`h-3.5 w-3.5 shrink-0 ${selected && o.value === "want" ? "fill-current" : ""}`} />
            <span className="truncate">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function PrivacyNote() {
  const { t } = useTranslation()
  return (
    <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
      <Lock className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{t("prefs.privacy")}</span>
    </div>
  )
}

// Optimistic save with revert: the toggle flips at once, the server confirms.
async function savePref(
  targetId: string,
  next: Choice,
  apply: (c: Choice) => void,
  previous: Choice,
  errorText: string,
  errorTitle: string,
) {
  apply(next)
  try {
    const { ok } = await setTeammatePreference(targetId, next)
    if (!ok) throw new Error("not saved")
  } catch {
    apply(previous)
    toast({ title: errorTitle, description: errorText, variant: "destructive" })
  }
}

// Owner's list on their own profile.
export function TeammatePreferencesList() {
  const { t } = useTranslation()
  const [players, setPlayers] = useState<PreferenceCandidate[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getMyTeammatePreferences()
      .then((rows) => active && setPlayers(rows))
      .catch((error) => console.error("Error loading teammate preferences:", error))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const counts = useMemo(() => {
    const list = players ?? []
    return { want: list.filter((p) => p.pref === "want").length, ok: list.filter((p) => p.pref === "ok").length }
  }, [players])

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    return (players ?? []).filter((p) => !q || p.name.toLocaleLowerCase().includes(q))
  }, [players, query])

  const change = async (player: PreferenceCandidate, next: Choice) => {
    setSavingId(player.id)
    await savePref(
      player.id,
      next,
      (c) => setPlayers((prev) => prev?.map((p) => (p.id === player.id ? { ...p, pref: c } : p)) ?? prev),
      player.pref,
      t("prefs.saveError"),
      t("common.error"),
    )
    setSavingId(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5" /> {t("prefs.title")}
        </CardTitle>
        <CardDescription>{t("prefs.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : players === null ? (
          <p className="text-sm text-muted-foreground">{t("prefs.signInNeeded")}</p>
        ) : players.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("prefs.empty")}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-green-50 px-2 py-1 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                {t("prefs.countWant", { count: counts.want })}
              </span>
              <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                {t("prefs.countOk", { count: counts.ok })}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("common.searchName")}
                className="pl-9"
              />
            </div>
            <div className="space-y-2">
              {visible.map((player) => (
                <div key={player.id} className="space-y-2 rounded-md border bg-background p-2">
                  <div className="flex items-center gap-2">
                    {player.photo_url ? (
                      <img
                        src={player.photo_url}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-full bg-muted object-cover object-top"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {player.name.charAt(0).toLocaleUpperCase()}
                      </div>
                    )}
                    <Link href={`/profile/${player.id}`} className="min-w-0 truncate text-sm font-medium hover:underline">
                      {player.name}
                    </Link>
                    {savingId === player.id && (
                      <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <PreferenceToggle
                    value={player.pref}
                    onChange={(next) => change(player, next)}
                    disabled={savingId === player.id}
                  />
                </div>
              ))}
            </div>
          </>
        )}
        <PrivacyNote />
      </CardContent>
    </Card>
  )
}

// Toggle card on another player's profile. Renders nothing unless the viewer
// is signed in and this player can be picked.
export function TeammatePreferenceCard({ targetId, targetName }: { targetId: string; targetName: string }) {
  const { t } = useTranslation()
  const [state, setState] = useState<{ canPick: boolean; pref: Choice } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    setState(null)
    getMyPreferenceFor(targetId)
      .then((res) => active && setState(res))
      .catch((error) => console.error("Error loading teammate preference:", error))
    return () => {
      active = false
    }
  }, [targetId])

  if (!state?.canPick) return null

  const change = async (next: Choice) => {
    setSaving(true)
    await savePref(
      targetId,
      next,
      (c) => setState((prev) => (prev ? { ...prev, pref: c } : prev)),
      state.pref,
      t("prefs.saveError"),
      t("common.error"),
    )
    setSaving(false)
  }

  return (
    <div className="mt-4 space-y-2 rounded-lg border p-3">
      <p className="text-sm font-medium">{t("prefs.askAbout", { name: targetName })}</p>
      <PreferenceToggle value={state.pref} onChange={change} disabled={saving} />
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="h-3 w-3 shrink-0" /> {t("prefs.privateShort")}
      </p>
    </div>
  )
}
