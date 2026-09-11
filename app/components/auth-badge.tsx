"use client"

// Header chip for the signed-in player: photo (or initial) plus first name.
// Renders nothing at all when signed out, so the header is unchanged for the
// logged-out visitors who are still the majority.

import Image from "next/image"
import { useCurrentPlayer } from "@/app/lib/use-current-player"

export function AuthBadge({ onSelect }: { onSelect?: () => void }) {
  const { player, loading } = useCurrentPlayer()

  if (loading || !player) return null

  const firstName = player.name.trim().split(/\s+/)[0]
  const initial = firstName.charAt(0).toLocaleUpperCase("tr-TR")

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex max-w-[8rem] items-center gap-1.5 rounded-full border px-2 py-1 text-sm transition-colors hover:bg-muted"
      aria-label={firstName}
    >
      {player.photo_url ? (
        <Image
          src={player.photo_url}
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 shrink-0 rounded-full object-cover"
          unoptimized
        />
      ) : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initial}
        </span>
      )}
      <span className="truncate">{firstName}</span>
    </button>
  )
}

export default AuthBadge
