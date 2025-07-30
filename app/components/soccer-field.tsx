"use client"

import { useDroppable } from "@dnd-kit/core"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { useState } from "react"
import type { PlayerWithDetails } from "@/app/lib/types"
import { X, ChevronDown } from "lucide-react"
import Image from "next/image" // Import Next.js Image

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
      className={`relative w-full aspect-[2/3] bg-emerald-700 rounded-lg overflow-hidden border-2 border-emerald-800 shadow-md`}
    >
      {/* Field markings */}
      <div className="absolute inset-0 flex flex-col">
        <div className="h-1/2 border-b-2 border-white/70"></div>
        <div className="absolute top-1/2 left-1/2 w-16 h-16 border-2 border-white/70 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-1/2 w-32 h-16 border-2 border-white/70 rounded-t-full -translate-x-1/2"></div>
      </div>

      {/* Positions */}
      <div className="absolute inset-0 grid grid-rows-3 p-2">
        {/* Forwards (2) */}
        <div className="grid grid-cols-2 items-center">
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
    <div ref={setNodeRef} className="flex justify-center p-1 h-full relative">
      <div
        className={`w-full h-full min-h-[60px] ${
          isOver ? "bg-white/30" : "bg-white/10"
        } rounded-md flex items-center justify-center p-0.5 transition-colors relative`} // Reduced padding for more space
      >
        {player ? (
          <PositionedPlayer player={player} team={team} onRemove={onRemove} />
        ) : (
          <div
            onClick={onClick}
            className={`w-full h-full min-h-[50px] rounded border-2 border-dashed ${
              isActive ? "border-white bg-white/20" : isOver ? "border-white" : "border-white/30"
            } flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-colors`}
          >
            <span className="text-xs text-white/90">{label}</span>
            <ChevronDown className="h-3 w-3 text-white/70 mt-1" />
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
                  {unassignedPlayer.photo_url ? (
                    <div className="flex items-center">
                      <div
                        className="relative w-8 h-8 mr-2 rounded-sm overflow-hidden flex-shrink-0"
                        style={{ aspectRatio: `${560 / 782}` }}
                      >
                        <Image
                          src={unassignedPlayer.photo_url || "/placeholder.svg"}
                          alt={unassignedPlayer.name}
                          layout="fill"
                          objectFit="contain"
                          unoptimized={unassignedPlayer.photo_url.includes("supabase.co")}
                        />
                      </div>
                      <span className="font-medium dark:text-white truncate">{unassignedPlayer.name}</span>
                    </div>
                  ) : (
                    <div className="font-medium dark:text-white">{unassignedPlayer.name}</div>
                  )}
                  {unassignedPlayer.position &&
                    !unassignedPlayer.photo_url && ( // Show position only if no photo
                      <div className="text-gray-500 dark:text-gray-400 text-xs">{unassignedPlayer.position}</div>
                    )}
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
        w-full h-full rounded-md shadow-sm cursor-grab active:cursor-grabbing 
        overflow-hidden relative border
        ${team === "A" ? "bg-blue-100 border-blue-300 dark:bg-blue-900 dark:border-blue-700" : "bg-red-100 border-red-300 dark:bg-red-900 dark:border-red-700"}
      `}
    >
      {player.photo_url ? (
        <Image
          src={player.photo_url || "/placeholder.svg"}
          alt={`${player.name}'s photo`}
          layout="fill"
          objectFit="contain" // Will fit the 560x782 image within the slot, preserving aspect ratio. Team background will show.
          unoptimized={player.photo_url.includes("supabase.co")}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-1 text-center">
          <span className="font-medium text-[10px] sm:text-xs leading-tight dark:text-white">{player.name}</span>
          {/* Optionally show preferred position if no photo and space allows */}
          {/* {player.position && <div className="text-[9px] text-gray-500 dark:text-gray-300 truncate">{player.position}</div>} */}
        </div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="absolute top-0.5 right-0.5 bg-white/70 dark:bg-gray-800/70 rounded-full p-px sm:p-0.5 shadow-md hover:bg-white dark:hover:bg-gray-700 z-10"
      >
        <X className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-gray-600 dark:text-gray-300" />
      </button>
    </div>
  )
}
