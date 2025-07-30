import { CardContent } from "@/components/ui/card"
import { CardTitle } from "@/components/ui/card"
import { CardHeader } from "@/components/ui/card"
import { Card } from "@/components/ui/card"
import type { PlayerWithDetails } from "@/app/lib/types"

interface TeamPowerComparisonProps {
  teamAPlayers: PlayerWithDetails[]
  teamBPlayers: PlayerWithDetails[]
}

export default function TeamPowerComparison({ teamAPlayers, teamBPlayers }: TeamPowerComparisonProps) {
  // Calculate total power for each team
  const calculateTeamPower = (players: PlayerWithDetails[]) => {
    if (players.length === 0) return 0
    return players.reduce((sum, player) => sum + (player.power || 5), 0)
  }

  const teamAPower = calculateTeamPower(teamAPlayers)
  const teamBPower = calculateTeamPower(teamBPlayers)
  const totalPower = teamAPower + teamBPower

  // Calculate average power per player for each team
  const teamAAverage = teamAPlayers.length > 0 ? teamAPower / teamAPlayers.length : 0
  const teamBAverage = teamBPlayers.length > 0 ? teamBPower / teamBPlayers.length : 0

  // Calculate the position of the indicator (0-100%)
  // 50% means equal power, <50% means Team A stronger, >50% means Team B stronger
  const getIndicatorPosition = () => {
    if (totalPower === 0) return 50 // Center if no players

    // Calculate the ratio of Team B power to total power
    const teamBRatio = teamBPower / totalPower
      const adjusted = 1 / (1 + Math.exp(-6 * (teamBRatio - 0.5)));
    return adjusted * 100;
  }

  const indicatorPosition = getIndicatorPosition()

  // Determine which team is stronger and by how much
  const powerDifference = Math.abs(teamAPower - teamBPower)
  const strongerTeam = teamAPower > teamBPower ? "A" : teamBPower > teamAPower ? "B" : "equal"

  const getBalanceText = () => {
    if (powerDifference <= 2) return "Çok Dengeli"
    if (powerDifference <= 5) return "Dengeli"
    if (powerDifference <= 10) return "Az Dengesiz"
    return "Dengesiz"
  }

  const getBalanceColor = () => {
    if (strongerTeam === "equal" || powerDifference <= 2) return "text-green-600"
    if (powerDifference <= 5) return "text-yellow-600"
    if (powerDifference <= 10) return "text-orange-600"
    return "text-red-600"
  }

  return (
    <div className="mb-6">
      <Card className="border-2">
        <CardContent>
          {/* Team labels and power values */}
          <div className="flex justify-between items-center mb-3">
            <div className="text-center">
              <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Takım A</div>
              <div className="text-xs text-muted-foreground">({teamAPlayers.length} oyuncu)</div>
            </div>

            <div className="text-center">
              <div className={`text-sm font-medium ${getBalanceColor()}`}>{getBalanceText()}</div>
            </div>

            <div className="text-center">
              <div className="text-sm font-medium text-red-700 dark:text-red-300">Takım B</div>
              <div className="text-xs text-muted-foreground">({teamBPlayers.length} oyuncu)</div>
            </div>
          </div>

          {/* Power comparison bar */}
          <div className="relative">
            {/* Background bar */}
            <div className="w-full h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              {/* Team A side (left) */}
              <div className="absolute top-0 left-0 h-full bg-blue-500 opacity-30" style={{ width: "50%" }}></div>

              {/* Team B side (right) */}
              <div className="absolute top-0 right-0 h-full bg-red-500 opacity-30" style={{ width: "50%" }}></div>

              {/* Center divider */}
              <div className="absolute top-0 left-1/2 w-0.5 h-full bg-gray-400 dark:bg-gray-500 transform -translate-x-0.5"></div>

              {/* Power indicator */}
              <div
                className={`absolute top-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg transform -translate-y-1/2 -translate-x-1/2 transition-all duration-500 ${
                  strongerTeam === "A" ? "bg-blue-600" : strongerTeam === "B" ? "bg-red-600" : "bg-gray-600"
                }`}
                style={{ left: `${indicatorPosition}%` }}
              ></div>
            </div>

            {/* Scale markers */}
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Takım A Güçlü</span>
              <span>Eşit</span>
              <span>Takım B Güçlü</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
