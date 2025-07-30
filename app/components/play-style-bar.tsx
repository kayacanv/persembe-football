import type { PlayerWithDetails } from "@/app/lib/types"

interface PlayStyleBarProps {
  players: PlayerWithDetails[]
  team: "A" | "B"
}

export default function PlayStyleBar({ players, team }: PlayStyleBarProps) {
  // Calculate average position weight for the team
  const calculatePlayStyle = () => {
    if (players.length === 0) return 3 // Default neutral value

    const totalWeight = players.reduce((sum, player) => sum + (player.position_weight || 3), 0)
    return totalWeight / players.length
  }

  const averageWeight = calculatePlayStyle()

  // Convert weight (1-5) to percentage (0-100) for the bar
  const percentage = ((averageWeight - 1) / 4) * 100

  // Determine color based on play style
  const getColor = () => {
    if (averageWeight <= 2) return "bg-green-500" // Very defensive
    if (averageWeight <= 2.5) return "bg-green-400" // Defensive
    if (averageWeight <= 3.5) return "bg-yellow-500" // Balanced
    if (averageWeight <= 4) return "bg-orange-500" // Attacking
    return "bg-red-500" // Very attacking
  }

  const getStyleText = () => {
    if (averageWeight <= 2) return "Çok Defansif"
    if (averageWeight <= 2.5) return "Defansif"
    if (averageWeight <= 3.5) return "Dengeli"
    if (averageWeight <= 4) return "Hücumcu"
    return "Çok Hücumcu"
  }

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium">Oyun Stili</span>
        <span className="text-xs text-muted-foreground">{getStyleText()}</span>
      </div>

      {/* Play style bar */}
      <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        {/* Background gradient from green to red */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 opacity-30"></div>

        {/* Indicator */}
        <div
          className={`absolute top-0 left-0 h-full ${getColor()} transition-all duration-300 rounded-full`}
          style={{ width: `${Math.max(8, Math.min(percentage, 100))}%` }}
        ></div>

        {/* Center line for reference */}
        <div className="absolute top-0 left-1/2 w-0.5 h-full bg-gray-400 dark:bg-gray-500 transform -translate-x-0.5"></div>
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>Defansif</span>
        <span>Hücumcu</span>
      </div>
    </div>
  )
}
