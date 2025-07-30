import Image from "next/image"
import type { PlayerWithDetails } from "@/app/lib/types"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"

interface PlayerCardProps {
  player: PlayerWithDetails
  isDragging?: boolean
}

const CARD_ASPECT_RATIO = 560 / 782 // Approx 0.716

export default function PlayerCard({ player, isDragging }: PlayerCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: player.id,
    data: { player },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.85 : 1,
    touchAction: "none",
    aspectRatio: `${CARD_ASPECT_RATIO}`, // Apply aspect ratio to the card itself
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        bg-white dark:bg-gray-800 
        rounded-md shadow-sm cursor-grab active:cursor-grabbing 
        w-full border border-gray-200 dark:border-gray-700 
        hover:border-gray-300 dark:hover:border-gray-600 
        transition-colors overflow-hidden relative
        ${isDragging ? "ring-2 ring-primary scale-105 z-50" : ""} 
      `}
    >
      {player.photo_url ? (
        <Image
          src={player.photo_url || "/placeholder.svg"}
          alt={`${player.name}'s photo`}
          layout="fill"
          objectFit="cover" 
          priority={isDragging} // Prioritize image loading for drag overlay
          unoptimized={player.photo_url.includes("supabase.co")} // Avoid Next.js image optimization for Supabase URLs if not configured
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-1 text-center">
          {/* You can add a placeholder icon here if desired, e.g., <UserIcon /> */}
          <span className="font-medium text-[10px] sm:text-xs leading-tight dark:text-white">{player.name}</span>
        </div>
      )}
    </div>
  )
}
