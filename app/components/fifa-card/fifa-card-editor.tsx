"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Save, RotateCcw } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import FifaCard from "./fifa-card"
import { userToCardData } from "./types"
import { CARD_TIERS, CARD_TIER_ORDER } from "@/app/config/card-tiers"
import { updateUserCard, type CardUpdate } from "@/app/lib/profile-service"
import type { User } from "@/app/lib/types"

interface FifaCardEditorProps {
  user: User
  onSaved?: (updated: Partial<User>) => void
}

// FIFA position slots offered in the picker.
const POSITIONS = ["GK", "RB", "CB", "LB", "RWB", "LWB", "CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "CF", "ST"]

// Nations we ship a flag for (extend /public/flags as needed). 'tr' default.
const NATIONS: { code: string; label: string }[] = [
  { code: "tr", label: "Türkiye" },
  { code: "de", label: "Almanya" },
  { code: "gb", label: "İngiltere" },
  { code: "fr", label: "Fransa" },
  { code: "es", label: "İspanya" },
  { code: "it", label: "İtalya" },
  { code: "br", label: "Brezilya" },
  { code: "ar", label: "Arjantin" },
  { code: "nl", label: "Hollanda" },
  { code: "pt", label: "Portekiz" },
]

type StatKey = "pac" | "sho" | "pas" | "dri" | "def" | "phy"
const STAT_FIELDS: { key: StatKey; label: string }[] = [
  { key: "pac", label: "PAC (Hız)" },
  { key: "sho", label: "SHO (Şut)" },
  { key: "pas", label: "PAS (Pas)" },
  { key: "dri", label: "DRI (Çalım)" },
  { key: "def", label: "DEF (Defans)" },
  { key: "phy", label: "PHY (Fizik)" },
]

export default function FifaCardEditor({ user, onSaved }: FifaCardEditorProps) {
  // Local editable state, seeded from the user's current (DB) values via the mapper.
  const initial = useMemo(() => userToCardData(user), [user])

  const [overall, setOverall] = useState(initial.overall)
  const [position, setPosition] = useState(initial.position)
  const [tier, setTier] = useState(initial.tier)
  const [nation, setNation] = useState(initial.nation || "tr")
  const [stats, setStats] = useState(initial.stats)
  const [scale, setScale] = useState(initial.photo.scale)
  const [offsetX, setOffsetX] = useState(initial.photo.x)
  const [offsetY, setOffsetY] = useState(initial.photo.y)
  const [fade, setFade] = useState(initial.photo.fade)
  const [saving, setSaving] = useState(false)

  // Legacy baked PNG? Offer to convert to a live card.
  const isBaked = initial.baked && !!initial.photoUrl
  const [unbaked, setUnbaked] = useState(false)
  const showLive = !isBaked || unbaked

  // Build the preview CardData from current local state.
  const previewData = useMemo(
    () => ({
      ...initial,
      overall,
      position,
      tier,
      nation,
      stats,
      baked: isBaked && !unbaked,
      photo: { scale, x: offsetX, y: offsetY, fade },
    }),
    [initial, overall, position, tier, nation, stats, scale, offsetX, offsetY, fade, isBaked, unbaked],
  )

  const setStat = (key: StatKey, value: number) => setStats((s) => ({ ...s, [key]: value }))

  async function handleSave() {
    setSaving(true)
    const payload: CardUpdate = {
      card_overall: overall,
      card_position: position,
      card_tier: tier,
      card_nation: nation,
      card_pac: stats.pac,
      card_sho: stats.sho,
      card_pas: stats.pas,
      card_dri: stats.dri,
      card_def: stats.def,
      card_phy: stats.phy,
      card_photo_scale: scale,
      card_photo_x: offsetX,
      card_photo_y: offsetY,
      card_photo_fade: fade,
    }
    if (isBaked && unbaked) payload.card_baked = false

    const ok = await updateUserCard(user.id, payload)
    setSaving(false)
    if (ok) {
      toast({ title: "Kaydedildi", description: "Kart güncellendi." })
      onSaved?.({ ...payload })
    } else {
      toast({ title: "Hata", description: "Kart kaydedilemedi.", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      {/* Live preview — on top for mobile-first */}
      <div className="mx-auto w-full max-w-[240px]">
        <FifaCard data={previewData} />
      </div>

      {isBaked && !unbaked && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm dark:border-yellow-700/50 dark:bg-yellow-900/20">
          <p className="mb-2">
            Mevcut kartın hazır bir resim olarak yüklenmiş. Düzenlenebilir canlı karta geçmek ister misin?
          </p>
          <Button size="sm" variant="outline" onClick={() => setUnbaked(true)}>
            <RotateCcw className="mr-2 h-4 w-4" /> Canlı karta geç
          </Button>
        </div>
      )}

      {showLive && (
        <>
          {/* Overall */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Genel (Overall)</Label>
              <span className="text-sm font-bold tabular-nums">{overall}</span>
            </div>
            <Slider value={[overall]} min={0} max={99} step={1} onValueChange={(v) => setOverall(v[0])} />
          </div>

          {/* Position + Tier + Nation */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Pozisyon</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kart Türü</Label>
              <Select value={tier} onValueChange={(v) => setTier(v as typeof tier)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARD_TIER_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CARD_TIERS[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ülke</Label>
              <Select value={nation} onValueChange={setNation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NATIONS.map((n) => (
                    <SelectItem key={n.code} value={n.code}>
                      {n.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Six stats */}
          <div className="space-y-4">
            <Label className="text-base">İstatistikler</Label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {STAT_FIELDS.map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">{label}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      value={stats[key]}
                      onChange={(e) => setStat(key, Math.max(0, Math.min(99, Number(e.target.value) || 0)))}
                      className="h-8 w-16 text-center"
                    />
                  </div>
                  <Slider
                    value={[stats[key]]}
                    min={0}
                    max={99}
                    step={1}
                    onValueChange={(v) => setStat(key, v[0])}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Photo framing (only relevant when there is a photo) */}
          {initial.photoUrl && (
            <div className="space-y-4">
              <Label className="text-base">Fotoğraf Konumu</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Yakınlaştırma</Label>
                  <span className="text-sm tabular-nums">{scale.toFixed(2)}x</span>
                </div>
                <Slider value={[scale]} min={0.5} max={2} step={0.05} onValueChange={(v) => setScale(v[0])} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Yatay</Label>
                <Slider value={[offsetX]} min={-40} max={40} step={1} onValueChange={(v) => setOffsetX(v[0])} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Dikey</Label>
                <Slider value={[offsetY]} min={-40} max={40} step={1} onValueChange={(v) => setOffsetY(v[0])} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Alt kenarı karta karıştır</Label>
                <Switch checked={fade} onCheckedChange={setFade} />
              </div>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Kaydediliyor...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Kartı Kaydet
              </>
            )}
          </Button>
        </>
      )}
    </div>
  )
}
