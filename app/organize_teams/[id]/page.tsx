"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Users, Loader2, Save } from "lucide-react"
import { getMatchById, getPlayersForMatch } from "@/app/lib/data-service"
import type { PlayerWithDetails, Match } from "@/app/lib/types"
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
  DragOverlay,
} from "@dnd-kit/core"
import PlayerCard from "@/app/components/player-card"
import SoccerField from "@/app/components/soccer-field"
import PlayStyleBar from "@/app/components/play-style-bar"
import { balanceTeamsByPower } from "@/app/lib/data-service"
import { saveTeamPositions } from "@/app/actions/team-actions"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import TeamPowerComparison from "@/app/components/team-power-comparison"

// Define the positions for a 3-3-3 formation
const positionIds = [
  "defense-left",
  "defense-center",
  "defense-right",
  "midfield-left",
  "midfield-center",
  "midfield-right",
  "forward-left",
  "forward-center",
  "forward-right",
]

export default function OrganizeTeamsPage() {
  const params = useParams()
  const matchId = params.id as string

  const [match, setMatch] = useState<Match | null>(null)
  const [players, setPlayers] = useState<PlayerWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [teamA, setTeamA] = useState<Record<string, PlayerWithDetails | null>>({})
  const [teamB, setTeamB] = useState<Record<string, PlayerWithDetails | null>>({})
  const [activePlayer, setActivePlayer] = useState<PlayerWithDetails | null>(null)

  // Configure DnD sensors with lower activation constraint for easier dragging
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 2, // Reduced from 5 to make dragging more sensitive
      },
    }),
  )

  // Load match and players data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const matchData = await getMatchById(matchId)
        if (!matchData) {
          console.error("Match not found")
          return
        }

        setMatch(matchData)

        const playersData = await getPlayersForMatch(matchId)
        // Filter only active players
        const activePlayers = playersData.filter((p) => p.status === "active")
        setPlayers(activePlayers)

        // Initialize empty positions
        const initialTeamA: Record<string, PlayerWithDetails | null> = {}
        const initialTeamB: Record<string, PlayerWithDetails | null> = {}

        positionIds.forEach((pos) => {
          initialTeamA[pos] = null
          initialTeamB[pos] = null
        })

        // Populate teams based on existing data
        activePlayers.forEach((player) => {
          if (player.team === "A" && player.field_position > 0) {
            // Use field_position instead of position
            // Find the position ID based on the position number
            const posId = Object.entries(getPositionMap()).find(([, num]) => num === player.field_position)?.[0]
            if (posId) {
              initialTeamA[posId] = player
            }
          } else if (player.team === "B" && player.field_position > 0) {
            // Use field_position instead of position
            const posId = Object.entries(getPositionMap()).find(([, num]) => num === player.field_position)?.[0]
            if (posId) {
              initialTeamB[posId] = player
            }
          }
        })

        setTeamA(initialTeamA)
        setTeamB(initialTeamB)
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [matchId])

  // Get position map
  const getPositionMap = () => {
    return {
      "forward-left": 1,
      "forward-center": 2,
      "forward-right": 3,
      "midfield-left": 4,
      "midfield-center": 5,
      "midfield-right": 6,
      "defense-left": 7,
      "defense-center": 8,
      "defense-right": 9,
    }
  }

  // Check if a player is already assigned to a position
  const isPlayerAssigned = (playerId: string) => {
    for (const posId in teamA) {
      if (teamA[posId]?.id === playerId) return true
    }
    for (const posId in teamB) {
      if (teamB[posId]?.id === playerId) return true
    }
    return false
  }

  // Get unassigned players
  const unassignedPlayers = players.filter((player) => !isPlayerAssigned(player.id))

  // Get assigned players for each team
  const getTeamPlayers = (team: "A" | "B") => {
    const teamPositions = team === "A" ? teamA : teamB
    return Object.values(teamPositions).filter((player): player is PlayerWithDetails => player !== null)
  }

  // Check if all players are assigned to teams
  const areAllPlayersAssigned = () => {
    const assignedCount = getTeamPlayers("A").length + getTeamPlayers("B").length
    return assignedCount === players.length
  }

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const player = active.data.current?.player as PlayerWithDetails
    setActivePlayer(player)
  }

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      setActivePlayer(null)
      return
    }

    const playerId = active.id as string
    const player = players.find((p) => p.id === playerId)

    if (!player) {
      setActivePlayer(null)
      return
    }

    const overId = over.id as string

    // Check if dropping on a position
    if (overId.includes("forward") || overId.includes("midfield") || overId.includes("defense")) {
      const team = overId.endsWith("-A") ? "A" : "B"
      const positionBase = overId.substring(0, overId.lastIndexOf("-"))

      // Remove player from current position if already assigned
      removePlayerFromAllPositions(playerId)

      // Assign to new position
      if (team === "A") {
        setTeamA((prev) => ({ ...prev, [positionBase]: player }))
      } else {
        setTeamB((prev) => ({ ...prev, [positionBase]: player }))
      }
    }

    setActivePlayer(null)
  }

  // Remove a player from all positions
  const removePlayerFromAllPositions = (playerId: string) => {
    const newTeamA = { ...teamA }
    const newTeamB = { ...teamB }

    let changed = false

    for (const posId in newTeamA) {
      if (newTeamA[posId]?.id === playerId) {
        newTeamA[posId] = null
        changed = true
      }
    }

    for (const posId in newTeamB) {
      if (newTeamB[posId]?.id === playerId) {
        newTeamB[posId] = null
        changed = true
      }
    }

    if (changed) {
      setTeamA(newTeamA)
      setTeamB(newTeamB)
    }
  }

  // Remove a player from a position
  const removePlayer = (positionId: string, team: "A" | "B") => {
    if (team === "A") {
      setTeamA((prev) => ({ ...prev, [positionId]: null }))
    } else {
      setTeamB((prev) => ({ ...prev, [positionId]: null }))
    }
  }

  // Assign a player to a position
  const assignPlayer = (positionId: string, player: PlayerWithDetails, team: "A" | "B") => {
    // Remove player from current position if already assigned
    removePlayerFromAllPositions(player.id)

    // Assign to new position
    if (team === "A") {
      setTeamA((prev) => ({ ...prev, [positionId]: player }))
    } else {
      setTeamB((prev) => ({ ...prev, [positionId]: player }))
    }
  }

  // Auto-assign players based on their power ratings for balanced teams
  const autoAssignPlayers = () => {
    // Get currently assigned players and their teams
    const assignedTeamA = getTeamPlayers("A")
    const assignedTeamB = getTeamPlayers("B")

    // Get unassigned players
    const unassignedPlayersList = [...unassignedPlayers]

    // Reset positions but keep team assignments
    const newTeamA: Record<string, PlayerWithDetails | null> = {}
    const newTeamB: Record<string, PlayerWithDetails | null> = {}

    positionIds.forEach((pos) => {
      newTeamA[pos] = null
      newTeamB[pos] = null
    })

    // Balance unassigned players while considering already assigned players
    const { teamA: allTeamAPlayers, teamB: allTeamBPlayers } = balanceTeamsByPower(
      unassignedPlayersList,
      assignedTeamA,
      assignedTeamB,
    )

    // Assign players to positions based on their preferred positions if possible
    const assignPlayersByPosition = (
      teamPlayers: PlayerWithDetails[],
      team: Record<string, PlayerWithDetails | null>,
    ) => {
      // First, try to match players with their preferred positions
      teamPlayers.forEach((player) => {
        if (player.position) {
          // Map player position to position slots
          let matchingPositions: string[] = []

          if (player.position.includes("defans")) {
            matchingPositions = ["defense-left", "defense-center", "defense-right"]
          } else if (player.position.includes("orta")) {
            matchingPositions = ["midfield-left", "midfield-center", "midfield-right"]
          } else if (player.position.includes("forvet")) {
            matchingPositions = ["forward-left", "forward-center", "forward-right"]
          }

          // Try to assign to a matching position
          for (const posId of matchingPositions) {
            if (!team[posId]) {
              team[posId] = player
              return
            }
          }
        }
      })

      // Then, fill remaining positions with unassigned players
      const remainingPlayers = teamPlayers.filter((player) => !Object.values(team).some((p) => p?.id === player.id))

      positionIds.forEach((pos) => {
        if (!team[pos] && remainingPlayers.length > 0) {
          team[pos] = remainingPlayers.shift() || null
        }
      })
    }

    assignPlayersByPosition(allTeamAPlayers, newTeamA)
    assignPlayersByPosition(allTeamBPlayers, newTeamB)

    setTeamA(newTeamA)
    setTeamB(newTeamB)
  }

  // Reset all assignments
  const resetAssignments = () => {
    const emptyTeam: Record<string, PlayerWithDetails | null> = {}
    positionIds.forEach((pos) => {
      emptyTeam[pos] = null
    })

    setTeamA({ ...emptyTeam })
    setTeamB({ ...emptyTeam })
  }

  // Save team positions to the database
  const handleSavePositions = async () => {
    try {
      setSaving(true)

      // Prepare team data for saving
      const teamAData: Record<string, { id: string; match_player_id: string } | null> = {}
      const teamBData: Record<string, { id: string; match_player_id: string } | null> = {}

      // Process Team A
      for (const [posId, player] of Object.entries(teamA)) {
        teamAData[posId] = player ? { id: player.id, match_player_id: player.match_player_id } : null
      }

      // Process Team B
      for (const [posId, player] of Object.entries(teamB)) {
        teamBData[posId] = player ? { id: player.id, match_player_id: player.match_player_id } : null
      }

      // Call the server action to save positions
      const result = await saveTeamPositions(matchId, teamAData, teamBData)

      if (result.success) {
        toast({
          title: "Başarılı",
          description: "Takım pozisyonları kaydedildi.",
        })
      } else {
        toast({
          title: "Hata",
          description: result.error || "Takım pozisyonları kaydedilirken bir hata oluştu.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error saving positions:", error)
      toast({
        title: "Hata",
        description: "Takım pozisyonları kaydedilirken bir hata oluştu.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p>Yükleniyor...</p>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-6">Maç Bulunamadı</h1>
        <p className="mb-4">Belirtilen ID ile bir maç bulunamadı.</p>
        <Link href="/" passHref>
          <Button>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Ana Sayfaya Dön
          </Button>
        </Link>
      </div>
    )
  }

  const assignedCount = getTeamPlayers("A").length + getTeamPlayers("B").length

  return (
    <div className="min-h-screen bg-muted/30 pb-10">
      {/* Sticky top bar: back + title + primary actions */}
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="container max-w-5xl mx-auto px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Link href={`/match/${matchId}`} passHref>
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold leading-tight truncate">Takımları Düzenle</h1>
              <p className="text-xs text-muted-foreground leading-tight">
                {match.date} · {match.time}
              </p>
            </div>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 shrink-0"
              onClick={handleSavePositions}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="ml-1.5">Kaydet</span>
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="secondary" className="flex-1" onClick={autoAssignPlayers}>
              <Users className="mr-1.5 h-4 w-4" />
              Otomatik Oluştur
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={resetAssignments}>
              Sıfırla
            </Button>
          </div>
        </div>
      </header>

      <div className="container max-w-5xl mx-auto px-3 pt-4">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {/* Unassigned players — horizontal scroll strip */}
          <Card className="mb-4 overflow-hidden">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <span>Atanmamış Oyuncular</span>
                <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5">
                  {unassignedPlayers.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {unassignedPlayers.length === 0 ? (
                <div className="text-center py-3 text-sm text-muted-foreground">
                  Tüm oyuncular takımlara atandı
                </div>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
                  {unassignedPlayers.map((player) => (
                    <div key={player.id} className="w-[72px] sm:w-[84px] shrink-0 snap-start">
                      <PlayerCard player={player} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team formations — stacked on mobile, side-by-side from md */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Team A */}
            <Card className="overflow-hidden border-blue-200 dark:border-blue-900">
              <CardHeader className="py-3 bg-blue-50 dark:bg-blue-950/50">
                <CardTitle className="text-blue-700 dark:text-blue-300 text-base flex items-center justify-between">
                  <span>Takım A</span>
                  <span className="text-xs font-medium text-blue-600/70 dark:text-blue-400/70">
                    {getTeamPlayers("A").length}/9
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <SoccerField
                  team="A"
                  positions={teamA}
                  onRemovePlayer={(posId) => removePlayer(posId, "A")}
                  onAssignPlayer={(posId, player) => assignPlayer(posId, player, "A")}
                  unassignedPlayers={unassignedPlayers}
                />
              </CardContent>
              {areAllPlayersAssigned() ? (
                <PlayStyleBar players={getTeamPlayers("A")} team="A" />
              ) : (
                <div className="px-4 pb-3 text-center text-xs text-muted-foreground">
                  Oyun stili tüm oyuncular atandığında görünecek
                </div>
              )}
            </Card>

            {/* Team B */}
            <Card className="overflow-hidden border-red-200 dark:border-red-900">
              <CardHeader className="py-3 bg-red-50 dark:bg-red-950/50">
                <CardTitle className="text-red-700 dark:text-red-300 text-base flex items-center justify-between">
                  <span>Takım B</span>
                  <span className="text-xs font-medium text-red-600/70 dark:text-red-400/70">
                    {getTeamPlayers("B").length}/9
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <SoccerField
                  team="B"
                  positions={teamB}
                  onRemovePlayer={(posId) => removePlayer(posId, "B")}
                  onAssignPlayer={(posId, player) => assignPlayer(posId, player, "B")}
                  unassignedPlayers={unassignedPlayers}
                />
              </CardContent>
              {areAllPlayersAssigned() ? (
                <PlayStyleBar players={getTeamPlayers("B")} team="B" />
              ) : (
                <div className="px-4 pb-3 text-center text-xs text-muted-foreground">
                  Oyun stili tüm oyuncular atandığında görünecek
                </div>
              )}
            </Card>
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activePlayer ? (
              <div className="w-[84px]">
                <PlayerCard player={activePlayer} isDragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Team Power Comparison */}
        {areAllPlayersAssigned() ? (
          <div className="mt-4">
            <TeamPowerComparison teamAPlayers={getTeamPlayers("A")} teamBPlayers={getTeamPlayers("B")} />
          </div>
        ) : (
          <Card className="mt-4">
            <CardContent className="py-6">
              <div className="text-center text-muted-foreground">
                <Users className="mx-auto h-10 w-10 mb-3 opacity-50" />
                <h3 className="text-base font-medium mb-1">Takım Analizi</h3>
                <p className="text-sm">
                  Güç karşılaştırması tüm oyuncular ({assignedCount}/{players.length}) atandığında görünecek.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <Toaster />
    </div>
  )
}
