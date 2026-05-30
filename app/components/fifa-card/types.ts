import type { User } from "@/app/lib/types"
import type { CardTier } from "@/app/config/card-tiers"

export type { CardTier }

export interface CardStats {
  pac: number
  sho: number
  pas: number
  dri: number
  def: number
  phy: number
}

export interface CardPhotoTransform {
  scale: number
  x: number // % horizontal offset
  y: number // % vertical offset
  fade: boolean // blend the cutout's bottom edge into the card art
}

/** Normalized shape the FifaCard component renders from. */
export interface CardData {
  name: string
  overall: number
  position: string // FIFA slot, e.g. "ST" | "CB" | "GK"
  stats: CardStats
  nation?: string | null // ISO-ish code -> /flags/<code>.svg
  clubBadgeUrl?: string | null
  tier: CardTier
  photoUrl?: string | null
  /** TRUE when photoUrl is a legacy fully-baked card PNG: render raw, no overlays. */
  baked: boolean
  photo: CardPhotoTransform
}

const clamp = (n: number, lo = 0, hi = 99) => Math.max(lo, Math.min(hi, Math.round(n)))

// Position-flavored fallback stats around a neutral ~70 base, mirroring the SQL seed.
// Used only when DB card_* values are absent (defensive — they exist after the migration).
function fallbackFromPosition(position?: string | null): { stats: CardStats; cardPosition: string } {
  switch (position) {
    case "kaleci":
      return { stats: { pac: 58, sho: 35, pas: 60, dri: 52, def: 58, phy: 70 }, cardPosition: "GK" }
    case "defans":
      return { stats: { pac: 66, sho: 50, pas: 66, dri: 60, def: 80, phy: 78 }, cardPosition: "CB" }
    case "orta saha":
      return { stats: { pac: 72, sho: 68, pas: 78, dri: 76, def: 64, phy: 70 }, cardPosition: "CM" }
    case "forvet":
      return { stats: { pac: 80, sho: 82, pas: 68, dri: 78, def: 45, phy: 72 }, cardPosition: "ST" }
    default:
      return { stats: { pac: 70, sho: 65, pas: 70, dri: 70, def: 60, phy: 70 }, cardPosition: "CM" }
  }
}

/**
 * Map a DB User into the normalized CardData the component renders.
 * Reads the persisted card_* columns when present, falling back to position-derived
 * defaults so the card always renders even before the migration / for partial rows.
 */
export function userToCardData(user: Partial<User> & { name: string }): CardData {
  const fb = fallbackFromPosition(user.position)

  const stats: CardStats = {
    pac: clamp(user.card_pac ?? fb.stats.pac),
    sho: clamp(user.card_sho ?? fb.stats.sho),
    pas: clamp(user.card_pas ?? fb.stats.pas),
    dri: clamp(user.card_dri ?? fb.stats.dri),
    def: clamp(user.card_def ?? fb.stats.def),
    phy: clamp(user.card_phy ?? fb.stats.phy),
  }

  return {
    name: user.name,
    overall: clamp(user.card_overall ?? 70),
    position: user.card_position || fb.cardPosition,
    stats,
    nation: user.card_nation ?? "tr",
    clubBadgeUrl: user.club_badge_url ?? null,
    tier: (user.card_tier as CardTier) || "silver",
    photoUrl: user.photo_url ?? null,
    baked: user.card_baked ?? !!user.photo_url, // unknown legacy photo -> treat as baked
    photo: {
      scale: user.card_photo_scale ?? 1,
      x: user.card_photo_x ?? 0,
      y: user.card_photo_y ?? 0,
      fade: user.card_photo_fade ?? true,
    },
  }
}
