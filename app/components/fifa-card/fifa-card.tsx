"use client"

import { forwardRef } from "react"
import { cn } from "@/lib/utils"
import { getCardTierTheme } from "@/app/config/card-tiers"
import type { CardData } from "./types"
import { userToCardData } from "./types"
import type { User } from "@/app/lib/types"
import Silhouette from "./silhouette"
import type { PositionGroup } from "@/app/lib/rating"

interface FifaCardProps {
  /** Pass either a normalized CardData... */
  data?: CardData
  /** ...or a User (will be mapped via userToCardData). */
  user?: Partial<User> & { name: string }
  /** Tiny variant for field slots / drag chips: photo + rating only, no stat band. */
  compact?: boolean
  /** In compact mode, show a name band at the bottom so the player is identifiable. */
  showName?: boolean
  className?: string
}

// The five voted position ratings shown in the stat band (see app/lib/rating.ts).
const POSITION_KEYS: { key: PositionGroup; label: string }[] = [
  { key: "cf", label: "CF" },
  { key: "cm", label: "CM" },
  { key: "wm", label: "RM/LM" },
  { key: "fb", label: "RB/LB" },
  { key: "cb", label: "CB" },
]

// Card design grid is 560x782; every dimension below is expressed in `cqw`
// (1cqw = 1% of the card's own width), so the SAME component scales from the
// big profile card down to a tiny field slot by only changing the wrapper width.
const FifaCard = forwardRef<HTMLDivElement, FifaCardProps>(function FifaCard(
  { data, user, compact = false, showName = false, className },
  ref,
) {
  const card: CardData = data ?? userToCardData(user ?? { name: "" })
  const theme = getCardTierTheme(card.tier)
  const hasPhoto = !!card.photoUrl

  // Legacy fully-baked card PNG: render it raw (old PlayerPhotoCard behavior), no overlays.
  if (card.baked && hasPhoto) {
    return (
      <div
        ref={ref}
        className={cn("@container relative w-full select-none overflow-hidden", className)}
        style={{ aspectRatio: "560 / 782" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={card.photoUrl as string}
          alt={card.name}
          crossOrigin="anonymous"
          className="absolute inset-0 h-full w-full object-contain"
        />
      </div>
    )
  }

  const photoTransform = `translate(${card.photo.x}%, ${card.photo.y}%) scale(${card.photo.scale})`
  const fadeMask = card.photo.fade
    ? "linear-gradient(to bottom, #000 72%, transparent 99%)"
    : undefined

  return (
    <div
      ref={ref}
      className={cn("@container relative w-full select-none", className)}
      style={{ aspectRatio: "560 / 782" }}
    >
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          background: theme.frame,
          border: `0.9cqw solid ${theme.border}`,
          borderRadius: "5cqw",
          color: theme.text,
        }}
      >
        {/* --- Photo / silhouette layer (upper card) --- */}
        <div className="absolute left-0 right-0 top-0" style={{ height: "64%" }}>
          {hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.photoUrl as string}
              alt={card.name}
              crossOrigin="anonymous"
              className="absolute inset-0 h-full w-full object-contain object-bottom"
              style={{
                transform: photoTransform,
                transformOrigin: "bottom center",
                WebkitMaskImage: fadeMask,
                maskImage: fadeMask,
              }}
            />
          ) : (
            <Silhouette
              color={theme.silhouette}
              className="absolute bottom-0 left-1/2 h-[88%] -translate-x-1/2"
            />
          )}
        </div>

        {/* --- Rating + position (top-left) --- */}
        <div className="absolute" style={{ top: "5%", left: "7%", lineHeight: 1 }}>
          <div style={{ fontSize: "15cqw", fontWeight: 800, letterSpacing: "-0.03em" }}>
            {card.overall ?? "?"}
          </div>
          <div
            style={{
              fontSize: "5.5cqw",
              fontWeight: 700,
              marginTop: "0.5cqw",
              color: theme.accent,
            }}
          >
            {card.position}
          </div>
          <div
            style={{
              width: "9cqw",
              height: "0.5cqw",
              marginTop: "1cqw",
              background: theme.accent,
              opacity: 0.7,
            }}
          />
        </div>

        {/* --- Jersey / squad number (top-right, full card only) ---
            On compact field cards it lives in the bottom identity row instead, so it
            never collides with the remove (✕) button at the card's top-right corner. */}
        {!compact && card.jerseyNumber != null && (
          <div className="absolute text-right" style={{ top: "5%", right: "7%", lineHeight: 1 }}>
            <div style={{ fontSize: "8.5cqw", fontWeight: 800, letterSpacing: "-0.02em" }}>
              {card.jerseyNumber}
            </div>
            <div style={{ fontSize: "3cqw", fontWeight: 700, color: theme.accent, marginTop: "0.4cqw" }}>
              NO.
            </div>
          </div>
        )}

        {/* Subtle diagonal sheen for a more premium, less-flat card. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(125deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 38%, rgba(0,0,0,0.10) 100%)",
          }}
        />

        {compact && showName && (
          // Compact bottom band: name + nation flag + club badge, so the field card
          // reads like a real FIFA card and the player is identifiable on the pitch.
          <div
            className="absolute left-0 right-0 bottom-0"
            style={{
              padding: "6cqw 2cqw 2.5cqw",
              background: "linear-gradient(to top, rgba(0,0,0,0.72) 55%, transparent)",
            }}
          >
            <div
              className="text-center"
              style={{
                fontSize: "9cqw",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.01em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textShadow: "0 0.4cqw 1cqw rgba(0,0,0,0.7)",
                color: "#fff",
              }}
            >
              {card.name}
            </div>
            {(card.jerseyNumber != null || card.nation || card.clubBadgeUrl) && (
              <div
                className="flex items-center justify-center"
                style={{ gap: "2.6cqw", marginTop: "1.5cqw" }}
              >
                {card.jerseyNumber != null && (
                  <span
                    style={{
                      fontSize: "7cqw",
                      fontWeight: 800,
                      color: "#fff",
                      lineHeight: 1,
                      textShadow: "0 0.3cqw 0.8cqw rgba(0,0,0,0.7)",
                    }}
                  >
                    {card.jerseyNumber}
                  </span>
                )}
                {card.nation && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/flags/${card.nation}.svg`}
                    alt={card.nation}
                    crossOrigin="anonymous"
                    style={{ height: "8cqw", borderRadius: "1cqw", boxShadow: "0 0.3cqw 0.8cqw rgba(0,0,0,0.5)" }}
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).style.display = "none"
                    }}
                  />
                )}
                {card.clubBadgeUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.clubBadgeUrl}
                    alt="club"
                    crossOrigin="anonymous"
                    style={{ height: "9cqw", objectFit: "contain", filter: "drop-shadow(0 0.3cqw 0.6cqw rgba(0,0,0,0.5))" }}
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).style.display = "none"
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {!compact && (
          <>
            {/* --- Name band --- */}
            <div className="absolute left-0 right-0 text-center" style={{ top: "62%" }}>
              <div
                style={{
                  fontSize: "8cqw",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  padding: "1cqw 4cqw",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {card.name}
              </div>
              <div
                className="mx-auto"
                style={{ width: "72%", height: "0.45cqw", background: theme.accent, opacity: 0.55 }}
              />
            </div>

            {/* --- Voted position ratings (single band, value over label; "?" until rated) --- */}
            <div
              className="absolute left-0 right-0 flex justify-center"
              style={{ top: "73%", gap: "3cqw", padding: "0 5cqw" }}
            >
              {POSITION_KEYS.map(({ key, label }) => (
                <div key={key} className="flex flex-col items-center" style={{ lineHeight: 1.05 }}>
                  <span style={{ fontSize: "6.5cqw", fontWeight: 800 }}>{card.positionRatings?.[key] ?? "?"}</span>
                  <span style={{ fontSize: "3.4cqw", fontWeight: 600, color: theme.accent }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* --- Nation flag + club badge (bottom) --- */}
            <div
              className="absolute left-0 right-0 flex items-center justify-center"
              style={{ bottom: "4%", gap: "3cqw" }}
            >
              {card.nation && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/flags/${card.nation}.svg`}
                  alt={card.nation}
                  crossOrigin="anonymous"
                  style={{ height: "6cqw", borderRadius: "0.8cqw" }}
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = "none"
                  }}
                />
              )}
              {card.clubBadgeUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.clubBadgeUrl}
                  alt="club"
                  crossOrigin="anonymous"
                  style={{ height: "7cqw", objectFit: "contain" }}
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = "none"
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
})

export default FifaCard
