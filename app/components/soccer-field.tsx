"use client"

import type { CSSProperties } from "react"
import { useDroppable, useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { X } from "lucide-react"
import type { PlayerWithDetails } from "@/app/lib/types"
import FifaCard from "@/app/components/fifa-card/fifa-card"
import {
  BANDS,
  BAND_Y,
  BAND_LABEL,
  bandX,
  type BandId,
  type TeamShape,
  type TeamSide,
} from "@/app/lib/formation"

interface FormationPitchProps {
  team: TeamSide
  shape: TeamShape
  onRemovePlayer: (playerId: string) => void
  /** Tap-to-place fallback: fired when an empty part of a line is tapped while a bench player is selected. */
  onTapBand?: (band: BandId) => void
  /** True when a bench player is selected — highlights the lines as drop targets. */
  selecting?: boolean
}

// A team's pitch: five droppable lines (FWD..DEF) with cards auto-arranged symmetrically.
export default function FormationPitch({
  team,
  shape,
  onRemovePlayer,
  onTapBand,
  selecting,
}: FormationPitchProps) {
  const ring = team === "A" ? "ring-zinc-200 dark:ring-zinc-100" : "ring-zinc-800 dark:ring-zinc-900"

  return (
    <div
      className="relative w-full aspect-[3/4] overflow-hidden rounded-xl border-2 border-emerald-950/70 shadow-md"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to bottom, #15803d 0, #15803d 8.33%, #16a34a 8.33%, #16a34a 16.66%)",
      }}
    >
      {/* Pitch markings */}
      <div className="pointer-events-none absolute inset-2 rounded-sm border-2 border-white/30">
        <div className="absolute left-0 right-0 top-1/2 -translate-y-px border-t-2 border-white/30" />
        <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/30" />
        <div className="absolute left-1/2 top-0 h-9 w-24 -translate-x-1/2 border-2 border-t-0 border-white/30" />
        <div className="absolute bottom-0 left-1/2 h-9 w-24 -translate-x-1/2 border-2 border-b-0 border-white/30" />
      </div>

      {/* Soft vignette for depth */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 80% at 50% 40%, transparent 55%, rgba(0,0,0,0.28))" }}
      />

      {/* Droppable line strips (tiled top->bottom) */}
      {BANDS.map((band, i) => (
        <BandStrip
          key={band}
          team={team}
          band={band}
          topPct={i * 20}
          selecting={selecting}
          empty={shape[band].length === 0}
          onTapBand={onTapBand}
        />
      ))}

      {/* Cards layer (positioned; only the cards capture pointer events) */}
      <div className="pointer-events-none absolute inset-0">
        {BANDS.map((band) => {
          const arr = shape[band]
          const n = arr.length
          return arr.map((player, idx) => (
            <FieldCard
              key={player.id}
              player={player}
              ring={ring}
              leftPct={bandX(idx, n)}
              topPct={BAND_Y[band]}
              onRemove={() => onRemovePlayer(player.id)}
            />
          ))
        })}
      </div>
    </div>
  )
}

interface BandStripProps {
  team: TeamSide
  band: BandId
  topPct: number
  selecting?: boolean
  empty: boolean
  onTapBand?: (band: BandId) => void
}

function BandStrip({ team, band, topPct, selecting, empty, onTapBand }: BandStripProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `${team}:${band}` })

  return (
    <div
      ref={setNodeRef}
      onClick={() => onTapBand?.(band)}
      className={`absolute left-0 right-0 transition-colors ${
        isOver ? "bg-white/20" : selecting ? "bg-white/[0.06]" : ""
      }`}
      style={{ top: `${topPct}%`, height: "20%" }}
    >
      <span className="pointer-events-none absolute left-1.5 top-1 select-none text-[9px] font-semibold tracking-wider text-white/35">
        {BAND_LABEL[band]}
      </span>
      {selecting && empty && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white/45">
          +
        </span>
      )}
    </div>
  )
}

interface FieldCardProps {
  player: PlayerWithDetails
  ring: string
  leftPct: number
  topPct: number
  onRemove: () => void
}

function FieldCard({ player, ring, leftPct, topPct, onRemove }: FieldCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: player.id,
    data: { player },
  })

  const style: CSSProperties = {
    left: `${leftPct}%`,
    top: `${topPct}%`,
    transform: `translate(-50%, -50%) ${CSS.Translate.toString(transform) ?? ""}`,
    touchAction: "none",
    transition: isDragging ? undefined : "left 0.18s ease, top 0.18s ease",
    zIndex: isDragging ? 50 : 10,
    opacity: isDragging ? 0.9 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="pointer-events-auto absolute w-[17%] min-w-[46px] max-w-[64px]"
    >
      <div
        {...listeners}
        {...attributes}
        className={`relative cursor-grab rounded-lg shadow-lg ring-2 active:cursor-grabbing ${ring}`}
      >
        <FifaCard user={player} compact showName className="pointer-events-none overflow-hidden rounded-lg" />
      </div>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="absolute -right-1.5 -top-1.5 z-10 rounded-full border border-black/10 bg-white p-0.5 shadow-md hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
        aria-label="remove"
      >
        <X className="h-3 w-3 text-gray-700 dark:text-gray-300" />
      </button>
    </div>
  )
}
