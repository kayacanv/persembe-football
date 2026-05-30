"use client"

import { useDroppable } from "@dnd-kit/core"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { useState } from "react"
import type { PlayerWithDetails } from "@/app/lib/types"
import { X, ChevronDown } from "lucide-react"
import FifaCard from "@/app/components/fifa-card/fifa-card"

interface SoccerFieldProps {
  team: "A" | "B"
  positions: Record<string, PlayerWithDetails | null>
  onRemovePlayer: (positionId: string) => void
  onAssignPlayer: (positionId: string, player: PlayerWithDetails) => void
  unassignedPlayers: PlayerWithDetails[]
}

export default function SoccerField({
  team,
  positions,
  onRemovePlayer,
  onAssignPlayer,
  unassignedPlayers,
}: SoccerFieldProps) {
  const [activePosition, setActivePosition] = useState<string | null>(null)

  const handlePositionClick = (positionId: string) => {
    if (activePosition === positionId) {
      setActivePosition(null)
    } else {
      setActivePosition(positionId)
    }
  }

  const handlePlayerSelect = (positionId: string, player: PlayerWithDetails) => {
    onAssignPlayer(positionId, player)
    setActivePosition(null)
  }

  return (
    <div
      className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border-2 border-emerald-900 shadow-md"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to bottom, #15803d 0, #15803d 8.33%, #16a34a 8.33%, #16a34a 16.66%)",
      }}
    >
      {/* Field markings */}
      <div className="absolute inset-2 border-2 border-white/40 rounded-sm pointer-events-none">
        {/* Halfway line */}
        <div className="absolute top-1/2 left-0 right-0 border-t-2 border-white/40 -translate-y-px"></div>
        {/* Center circle */}
        <div className="absolute top-1/2 left-1/2 w-14 h-14 border-2 border-white/40 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
        {/* Top penalty box */}
        <div className="absolute top-0 left-1/2 w-24 h-10 border-2 border-t-0 border-white/40 -translate-x-1/2"></div>
        {/* Bottom penalty box */}
        <div className="absolute bottom-0 left-1/2 w-24 h-10 border-2 border-b-0 border-white/40 -translate-x-1/2"></div>
      </div>

      {/* Positions */}
      <div className="absolute inset-0 grid grid-rows-3 p-2">
        {/* Forwards (3) */}
        <div className="grid grid-cols-3 items-center">
          <PositionDroppable
            id={`forward-left-${team}`}
            player={positions["forward-left"]}
            team={team}
            label="Sol Forvet"
            onRemove={() => onRemovePlayer("forward-left")}
            isActive={activePosition === `forward-left-${team}`}
            onClick={() => handlePositionClick(`forward-left-${team}`)}
            unassignedPlayers={unassignedPlayers}
            onPlayerSelect={(player) => handlePlayerSelect("forward-left", player)}
          />
          <PositionDroppable
            id={`forward-center-${team}`}
            player={positions["forward-center"]}
            team={team}
            label="Orta Forvet"
            onRemove={() => onRemovePlayer("forward-center")}
            isActive={activePosition === `forward-center-${team}`}
            onClick={() => handlePositionClick(`forward-center-${team}`)}
            unassignedPlayers={unassignedPlayers}
            onPlayerSelect={(player) => handlePlayerSelect("forward-center", player)}
          />
          <PositionDroppable
            id={`forward-right-${team}`}
            player={positions["forward-right"]}
            team={team}
            label="Sağ Forvet"
            onRemove={() => onRemovePlayer("forward-right")}
            isActive={activePosition === `forward-right-${team}`}
            onClick={() => handlePositionClick(`forward-right-${team}`)}
            unassignedPlayers={unassignedPlayers}
            onPlayerSelect={(player) => handlePlayerSelect("forward-right", player)}
          />
        </div>

        {/* Midfielders (3) */}
        <div className="grid grid-cols-3 items-center">
          <PositionDroppable
            id={`midfield-left-${team}`}
            player={positions["midfield-left"]}
            team={team}
            label="Sol Orta"
            onRemove={() => onRemovePlayer("midfield-left")}
            isActive={activePosition === `midfield-left-${team}`}
            onClick={() => handlePositionClick(`midfield-left-${team}`)}
            unassignedPlayers={unassignedPlayers}
            onPlayerSelect={(player) => handlePlayerSelect("midfield-left", player)}
          />
          <PositionDroppable
            id={`midfield-center-${team}`}
            player={positions["midfield-center"]}
            team={team}
            label="Orta Saha"
            onRemove={() => onRemovePlayer("midfield-center")}
            isActive={activePosition === `midfield-center-${team}`}
            onClick={() => handlePositionClick(`midfield-center-${team}`)}
            unassignedPlayers={unassignedPlayers}
            onPlayerSelect={(player) => handlePlayerSelect("midfield-center", player)}
          />
          <PositionDroppable
            id={`midfield-right-${team}`}
            player={positions["midfield-right"]}
            team={team}
            label="Sağ Orta"
            onRemove={() => onRemovePlayer("midfield-right")}
            isActive={activePosition === `midfield-right-${team}`}
            onClick={() => handlePositionClick(`midfield-right-${team}`)}
            unassignedPlayers={unassignedPlayers}
            onPlayerSelect={(player) => handlePlayerSelect("midfield-right", player)}
          />
        </div>

        {/* Defenders (3) */}
        <div className="grid grid-cols-3 items-center">
          <PositionDroppable
            id={`defense-left-${team}`}
            player={positions["defense-left"]}
            team={team}
            label="Sol Defans"
            onRemove={() => onRemovePlayer("defense-left")}
            isActive={activePosition === `defense-left-${team}`}
            onClick={() => handlePositionClick(`defense-left-${team}`)}
            unassignedPlayers={unassignedPlayers}
            onPlayerSelect={(player) => handlePlayerSelect("defense-left", player)}
          />
          <PositionDroppable
            id={`defense-center-${team}`}
            player={positions["defense-center"]}
            team={team}
            label="Orta Defans"
            onRemove={() => onRemovePlayer("defense-center")}
            isActive={activePosition === `defense-center-${team}`}
            onClick={() => handlePositionClick(`defense-center-${team}`)}
            unassignedPlayers={unassignedPlayers}
            onPlayerSelect={(player) => handlePlayerSelect("defense-center", player)}
          />
          <PositionDroppable
            id={`defense-right-${team}`}
            player={positions["defense-right"]}
            team={team}
            label="Sağ Defans"
            onRemove={() => onRemovePlayer("defense-right")}
            isActive={activePosition === `defense-right-${team}`}
            onClick={() => handlePositionClick(`defense-right-${team}`)}
            unassignedPlayers={unassignedPlayers}
            onPlayerSelect={(player) => handlePlayerSelect("defense-right", player)}
          />
        </div>
      </div>
    </div>
  )
}

interface PositionDroppableProps {
  id: string
  player: PlayerWithDetails | null
  team: "A" | "B"
  label: string
  onRemove: () => void
  isActive: boolean
  onClick: () => void
  unassignedPlayers: PlayerWithDetails[]
  onPlayerSelect: (player: PlayerWithDetails) => void
}

function PositionDroppable({
  id,
  player,
  team,
  label,
  onRemove,
  isActive,
  onClick,
  unassignedPlayers,
  onPlayerSelect,
}: PositionDroppableProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  })

  return (
    <div ref={setNodeRef} className="flex justify-center items-center h-full relative px-0.5">
      <div
        className={`w-full h-full flex items-center justify-center transition-colors relative rounded-md ${
          player ? "" : isOver ? "bg-white/25" : ""
        }`}
      >
        {player ? (
          // Constrain the card so the pitch shows through and the formation reads as a formation.
          <div className="w-full max-w-[68px] sm:max-w-[84px]">
            <PositionedPlayer player={player} team={team} onRemove={onRemove} />
          </div>
        ) : (
          <div
            onClick={onClick}
            className={`w-full max-w-[60px] sm:max-w-[72px] aspect-[3/4] rounded-lg border-2 border-dashed ${
              isActive ? "border-white bg-white/25" : isOver ? "border-white bg-white/15" : "border-white/40"
            } flex flex-col items-center justify-center cursor-pointer hover:bg-white/15 transition-colors text-center px-1`}
          >
            <span className="text-[10px] leading-tight text-white/90">{label}</span>
            <ChevronDown className="h-3 w-3 text-white/70 mt-0.5" />
          </div>
        )}

        {/* Player selection popup */}
        {isActive && !player && unassignedPlayers.length > 0 && (
          <div className="absolute inset-0 bg-white/95 dark:bg-gray-800/95 rounded-md shadow-lg z-10">
            <div className="p-2 max-h-48 overflow-y-auto">
              <div className="text-xs font-medium mb-2 text-gray-700 dark:text-gray-300 flex justify-between items-center">
                <span>Oyuncu Seç</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onClick() // Close the dropdown
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              {unassignedPlayers.map((unassignedPlayer) => (
                <div
                  key={unassignedPlayer.id}
                  onClick={() => onPlayerSelect(unassignedPlayer)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm cursor-pointer text-xs mb-1 last:mb-0"
                >
                  <div className="flex items-center">
                    <div className="w-7 mr-2 flex-shrink-0">
                      <FifaCard user={unassignedPlayer} compact className="pointer-events-none" />
                    </div>
                    <span className="font-medium dark:text-white truncate">{unassignedPlayer.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface PositionedPlayerProps {
  player: PlayerWithDetails
  team: "A" | "B"
  onRemove: () => void
}

function PositionedPlayer({ player, team, onRemove }: PositionedPlayerProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: player.id,
    data: {
      player,
      fromPosition: true,
    },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    touchAction: "none",
  }

  return (
    <div // This is the draggable element, fills the slot.
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        w-full cursor-grab active:cursor-grabbing
        relative rounded-lg ring-2 ${team === "A" ? "ring-blue-400 dark:ring-blue-500" : "ring-red-400 dark:ring-red-500"}
        shadow-lg
      `}
    >
      <FifaCard user={player} compact showName className="pointer-events-none rounded-lg overflow-hidden" />
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="absolute -top-1.5 -right-1.5 bg-white dark:bg-gray-800 rounded-full p-0.5 shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 z-10 border border-black/10"
      >
        <X className="h-3 w-3 text-gray-700 dark:text-gray-300" />
      </button>
    </div>
  )
}
