// Card tier themes for the in-app FIFA-style player card.
//
// All art is ORIGINAL (gradients/colors authored here) — no EA/FIFA or club artwork is
// shipped, so there is zero IP risk on the public repo. Themes are applied as inline
// styles by FifaCard, which keeps Phase 1 out of globals.css. A richer CSS pass
// (metallic sheens, diagonal sweeps) can layer on top later.

export type CardTier = "bronze" | "silver" | "gold" | "special" | "fener"

export interface CardTierTheme {
  /** Human label (Turkish UI). */
  label: string
  /** Full-card background (the "frame" look). */
  frame: string
  /** Outer border color. */
  border: string
  /** Primary text color (rating, name, stat values). */
  text: string
  /** Secondary/accent color (stat labels, divider lines, position). */
  accent: string
  /** Translucent name-band background. */
  band: string
  /** Tint applied to the no-photo silhouette. */
  silhouette: string
}

export const CARD_TIERS: Record<CardTier, CardTierTheme> = {
  bronze: {
    label: "Bronz",
    frame: "linear-gradient(160deg, #7c4a22 0%, #b97a39 38%, #e3ad6b 54%, #9c5f2c 100%)",
    border: "#5e3717",
    text: "#3a2410",
    accent: "#5e3717",
    band: "rgba(58, 36, 16, 0.16)",
    silhouette: "rgba(58, 36, 16, 0.45)",
  },
  silver: {
    label: "Gümüş",
    frame: "linear-gradient(160deg, #7f858f 0%, #c2c8d1 40%, #eef1f6 54%, #9aa0ab 100%)",
    border: "#5d626b",
    text: "#23272e",
    accent: "#4a4f57",
    band: "rgba(35, 39, 46, 0.14)",
    silhouette: "rgba(35, 39, 46, 0.40)",
  },
  gold: {
    label: "Altın",
    frame: "linear-gradient(160deg, #a9780e 0%, #ddbb4a 40%, #fbeeab 54%, #bf962b 100%)",
    border: "#7c5a0c",
    text: "#3a2c05",
    accent: "#6d5009",
    band: "rgba(58, 44, 5, 0.16)",
    silhouette: "rgba(58, 44, 5, 0.42)",
  },
  special: {
    label: "Özel",
    frame: "linear-gradient(160deg, #131318 0%, #2a2a33 44%, #3c3c47 54%, #101015 100%)",
    border: "#0a0a0d",
    text: "#f6d873",
    accent: "#e6b94d",
    band: "rgba(246, 216, 115, 0.14)",
    silhouette: "rgba(246, 216, 115, 0.30)",
  },
  fener: {
    label: "Fenerbahçe",
    frame: "linear-gradient(160deg, #0a1747 0%, #15287a 44%, #1d3aa0 54%, #0a1747 100%)",
    border: "#ffe11a",
    text: "#ffe11a",
    accent: "#ffe11a",
    band: "rgba(255, 225, 26, 0.14)",
    silhouette: "rgba(255, 225, 26, 0.28)",
  },
}

export const CARD_TIER_ORDER: CardTier[] = ["bronze", "silver", "gold", "special", "fener"]

export function getCardTierTheme(tier?: string | null): CardTierTheme {
  if (tier && tier in CARD_TIERS) return CARD_TIERS[tier as CardTier]
  return CARD_TIERS.silver
}
