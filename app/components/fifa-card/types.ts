import type { User } from "@/app/lib/types"
import { hasRatings, overallFor, type PlayerRating, type PositionRatings } from "@/app/lib/rating"
import type { CardTier } from "@/app/config/card-tiers"

export type { CardTier }

export interface CardPhotoTransform {
  scale: number
  x: number // % horizontal offset
  y: number // % vertical offset
  fade: boolean // blend the cutout's bottom edge into the card art
}

/** Normalized shape the FifaCard component renders from. */
export interface CardData {
  name: string
  /** Crowd-voted overall at `position`; null until enough voters (card shows "?"). */
  overall: number | null
  position: string // FIFA slot, e.g. "ST" | "CB" | "GK"
  jerseyNumber?: number | null // editable squad/shirt number (1-99); null = none
  /** The five voted position ratings shown in the stat band; null until enough voters. */
  positionRatings: PositionRatings | null
  rating: PlayerRating | null
  nation?: string | null // ISO-ish code -> /flags/<code>.svg
  clubBadgeUrl?: string | null
  tier: CardTier
  photoUrl?: string | null
  /** TRUE when photoUrl is a legacy fully-baked card PNG: render raw, no overlays. */
  baked: boolean
  photo: CardPhotoTransform
}

// Old Turkish position → FIFA slot, for rows that predate the card columns.
function fallbackPosition(position?: string | null): string {
  switch (position) {
    case "kaleci":
      return "GK"
    case "defans":
      return "CB"
    case "forvet":
      return "ST"
    default:
      return "CM"
  }
}

/**
 * Map a DB User into the normalized CardData the component renders.
 * Cosmetic fields come from the card_* columns; the overall and the position
 * ratings come from the crowd-voted player_ratings row (see app/lib/rating.ts).
 */
export function userToCardData(user: Partial<User> & { name: string }): CardData {
  const position = user.card_position || fallbackPosition(user.position)
  const rating = user.rating ?? null

  return {
    name: user.name,
    overall: overallFor(rating, position),
    position,
    jerseyNumber: user.jersey_number ?? null,
    positionRatings: hasRatings(rating) ? rating : null,
    rating,
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
