import type { PlayerWithDetails } from "@/app/lib/types"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import FifaCard from "@/app/components/fifa-card/fifa-card"

interface PlayerCardProps {
  player: PlayerWithDetails
  isDragging?: boolean
}

// Thin @dnd-kit draggable wrapper. The FifaCard is a pure presentational child
// (no transform, pointer-events-none) so dragging / DragOverlay keep working.
export default function PlayerCard({ player, isDragging }: PlayerCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: player.id,
    data: { player },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.85 : 1,
    touchAction: "none" as const,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`w-full cursor-grab active:cursor-grabbing transition-transform ${
        isDragging ? "scale-105 z-50" : ""
      }`}
    >
      <FifaCard user={player} compact showName className="pointer-events-none rounded-lg overflow-hidden shadow-md" />
    </div>
  )
}
