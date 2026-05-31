"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Loader2, Save, RotateCcw, Check, ChevronsUpDown } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import FifaCard from "./fifa-card"
import { userToCardData } from "./types"
import { CARD_TIERS, CARD_TIER_ORDER } from "@/app/config/card-tiers"
import { CLUBS, clubLogoPath, findClub } from "@/app/config/clubs"
import { updateUserCard, type CardUpdate } from "@/app/lib/profile-service"
import type { User } from "@/app/lib/types"
import { useTranslation } from "@/lib/i18n/useTranslation"

interface FifaCardEditorProps {
  user: User
  onSaved?: (updated: Partial<User>) => void
}

// FIFA position slots offered in the picker.
const POSITIONS = ["GK", "RB", "CB", "LB", "RWB", "LWB", "CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "CF", "ST"]

// Nations we ship a flag for (extend /public/flags as needed). 'tr' default.
// `code` is the stored/flag value (unchanged); `i18nKey` maps to a country.* label.
const NATIONS: { code: string; i18nKey: string }[] = [
  { code: "tr", i18nKey: "country.turkey" },
  { code: "de", i18nKey: "country.germany" },
  { code: "gb", i18nKey: "country.england" },
  { code: "fr", i18nKey: "country.france" },
  { code: "es", i18nKey: "country.spain" },
  { code: "it", i18nKey: "country.italy" },
  { code: "br", i18nKey: "country.brazil" },
  { code: "ar", i18nKey: "country.argentina" },
  { code: "nl", i18nKey: "country.netherlands" },
  { code: "pt", i18nKey: "country.portugal" },
]

type StatKey = "pac" | "sho" | "pas" | "dri" | "def" | "phy"
// `i18nKey` maps to a fifacard.* label; the stat key/value logic is unchanged.
const STAT_FIELDS: { key: StatKey; i18nKey: string }[] = [
  { key: "pac", i18nKey: "fifacard.statPac" },
  { key: "sho", i18nKey: "fifacard.statSho" },
  { key: "pas", i18nKey: "fifacard.statPas" },
  { key: "dri", i18nKey: "fifacard.statDri" },
  { key: "def", i18nKey: "fifacard.statDef" },
  { key: "phy", i18nKey: "fifacard.statPhy" },
]

// Map a tier id (config key) to its cardtier.* display label key.
const TIER_LABEL_KEYS: Record<string, string> = {
  bronze: "cardtier.bronze",
  silver: "cardtier.silver",
  gold: "cardtier.gold",
  special: "cardtier.special",
  fener: "cardtier.fenerbahce",
}

export default function FifaCardEditor({ user, onSaved }: FifaCardEditorProps) {
  const { t } = useTranslation()
  // Local editable state, seeded from the user's current (DB) values via the mapper.
  const initial = useMemo(() => userToCardData(user), [user])

  const [overall, setOverall] = useState(initial.overall)
  const [jerseyNumber, setJerseyNumber] = useState<number | null>(initial.jerseyNumber ?? null)
  const [position, setPosition] = useState(initial.position)
  const [tier, setTier] = useState(initial.tier)
  const [nation, setNation] = useState(initial.nation || "tr")
  const [clubBadgeUrl, setClubBadgeUrl] = useState<string | null>(initial.clubBadgeUrl ?? null)
  const [clubOpen, setClubOpen] = useState(false)
  const [stats, setStats] = useState(initial.stats)
  const [scale, setScale] = useState(initial.photo.scale)
  const [offsetX, setOffsetX] = useState(initial.photo.x)
  const [offsetY, setOffsetY] = useState(initial.photo.y)
  const [saving, setSaving] = useState(false)
  // The bottom fade is always on — it's the classic FIFA-card look (no UI toggle).
  const fade = true

  // Legacy baked PNG? Offer to convert to a live card.
  const isBaked = initial.baked && !!initial.photoUrl
  const [unbaked, setUnbaked] = useState(false)
  const showLive = !isBaked || unbaked

  // Build the preview CardData from current local state.
  const previewData = useMemo(
    () => ({
      ...initial,
      overall,
      jerseyNumber,
      position,
      tier,
      nation,
      clubBadgeUrl,
      stats,
      baked: isBaked && !unbaked,
      photo: { scale, x: offsetX, y: offsetY, fade },
    }),
    [initial, overall, jerseyNumber, position, tier, nation, clubBadgeUrl, stats, scale, offsetX, offsetY, fade, isBaked, unbaked],
  )

  const setStat = (key: StatKey, value: number) => setStats((s) => ({ ...s, [key]: value }))
  const selectedClub = findClub(clubBadgeUrl)

  async function handleSave() {
    setSaving(true)
    const payload: CardUpdate = {
      card_overall: overall,
      jersey_number: jerseyNumber,
      card_position: position,
      card_tier: tier,
      card_nation: nation,
      club_badge_url: clubBadgeUrl,
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
      toast({ title: t("common.saved"), description: t("fifacard.cardUpdated") })
      onSaved?.({ ...payload })
    } else {
      toast({ title: t("common.error"), description: t("fifacard.cardSaveFailed"), variant: "destructive" })
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
          <p className="mb-2">{t("fifacard.bakedCardMessage")}</p>
          <Button size="sm" variant="outline" onClick={() => setUnbaked(true)}>
            <RotateCcw className="mr-2 h-4 w-4" /> {t("fifacard.switchToLiveCard")}
          </Button>
        </div>
      )}

      {showLive && (
        <>
          {/* Overall */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("fifacard.overall")}</Label>
              <span className="text-sm font-bold tabular-nums">{overall}</span>
            </div>
            <Slider value={[overall]} min={0} max={99} step={1} onValueChange={(v) => setOverall(v[0])} />
          </div>

          {/* Jersey / squad number */}
          <div className="space-y-2">
            <Label>{t("fifacard.jerseyNumber")}</Label>
            <Input
              type="number"
              min={1}
              max={99}
              inputMode="numeric"
              placeholder={t("fifacard.jerseyNumberNone")}
              value={jerseyNumber ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim()
                if (v === "") return setJerseyNumber(null)
                setJerseyNumber(Math.max(1, Math.min(99, Math.floor(Number(v) || 0))))
              }}
              className="h-9 w-28 text-center"
            />
          </div>

          {/* Position + Tier + Nation */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>{t("fifacard.position")}</Label>
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
              <Label>{t("fifacard.cardType")}</Label>
              <Select value={tier} onValueChange={(v) => setTier(v as typeof tier)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARD_TIER_ORDER.map((tierId) => (
                    <SelectItem key={tierId} value={tierId}>
                      {TIER_LABEL_KEYS[tierId] ? t(TIER_LABEL_KEYS[tierId]) : CARD_TIERS[tierId].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("fifacard.country")}</Label>
              <Select value={nation} onValueChange={setNation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NATIONS.map((n) => (
                    <SelectItem key={n.code} value={n.code}>
                      {t(n.i18nKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Team (searchable) */}
          <div className="space-y-2">
            <Label>{t("fifacard.team")}</Label>
            <Popover open={clubOpen} onOpenChange={setClubOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={clubOpen}
                  className="w-full justify-between font-normal"
                >
                  <span className="flex items-center gap-2 truncate">
                    {selectedClub ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={clubLogoPath(selectedClub.slug)} alt="" className="h-5 w-5 object-contain" />
                        {selectedClub.name}
                      </>
                    ) : (
                      <span className="text-muted-foreground">{t("fifacard.teamSelect")}</span>
                    )}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t("fifacard.teamSearch")} />
                  <CommandList>
                    <CommandEmpty>{t("fifacard.teamNotFound")}</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__none__"
                        onSelect={() => {
                          setClubBadgeUrl(null)
                          setClubOpen(false)
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", clubBadgeUrl ? "opacity-0" : "opacity-100")} />
                        {t("fifacard.noTeam")}
                      </CommandItem>
                      {CLUBS.map((club) => (
                        <CommandItem
                          key={club.slug}
                          value={`${club.name} ${club.country}`}
                          onSelect={() => {
                            setClubBadgeUrl(clubLogoPath(club.slug))
                            setClubOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedClub?.slug === club.slug ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={clubLogoPath(club.slug)} alt="" className="mr-2 h-5 w-5 object-contain" />
                          {club.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Six stats */}
          <div className="space-y-4">
            <Label className="text-base">{t("fifacard.statsHeading")}</Label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {STAT_FIELDS.map(({ key, i18nKey }) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">{t(i18nKey)}</Label>
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
              <Label className="text-base">{t("fifacard.photoPosition")}</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{t("fifacard.zoom")}</Label>
                  <span className="text-sm tabular-nums">{scale.toFixed(2)}x</span>
                </div>
                <Slider value={[scale]} min={0.5} max={2} step={0.05} onValueChange={(v) => setScale(v[0])} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{t("fifacard.horizontal")}</Label>
                  <span className="text-sm tabular-nums">{offsetX}</span>
                </div>
                <Slider value={[offsetX]} min={-100} max={100} step={1} onValueChange={(v) => setOffsetX(v[0])} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{t("fifacard.vertical")}</Label>
                  <span className="text-sm tabular-nums">{offsetY}</span>
                </div>
                <Slider value={[offsetY]} min={-100} max={100} step={1} onValueChange={(v) => setOffsetY(v[0])} />
              </div>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.saving")}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> {t("fifacard.saveCard")}
              </>
            )}
          </Button>
        </>
      )}
    </div>
  )
}
