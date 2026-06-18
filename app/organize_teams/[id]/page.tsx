"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Users, Loader2, Save, Eraser } from "lucide-react"
import { getMatchById, getPlayersForMatch, balanceTeamsByPower } from "@/app/lib/data-service"
import type { PlayerWithDetails, Match } from "@/app/lib/types"
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
  DragOverlay,
  useDroppable,
  closestCenter,
} from "@dnd-kit/core"
import PlayerCard from "@/app/components/player-card"
import FifaCard from "@/app/components/fifa-card/fifa-card"
import FormationPitch from "@/app/components/soccer-field"
import PlayStyleBar from "@/app/components/play-style-bar"
import { saveTeamPositions } from "@/app/actions/team-actions"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import TeamPowerComparison from "@/app/components/team-power-comparison"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { formatMatchDate } from "@/lib/i18n/format"
import {
  type BandId,
  type TeamShape,
  type TeamSide,
  emptyShape,
  cloneShape,
  removeFromShape,
  shapePlayers,
  shapeFromPlayers,
  autoShape,
  formationString,
  shapeToPlacements,
} from "@/app/lib/formation"

type Teams = { A: TeamShape; B: TeamShape }

export default function OrganizeTeamsPage() {
  const { t, locale } = useTranslation()
  const params = useParams()
  const matchId = params.id as string

  const [match, setMatch] = useState<Match | null>(null)
  const [players, setPlayers] = useState<PlayerWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [teams, setTeams] = useState<Teams>({ A: emptyShape(), B: emptyShape() })
  const [activePlayer, setActivePlayer] = useState<PlayerWithDetails | null>(null)
  // Tap-to-place fallback: a selected bench player drops into the next tapped line.
  const [selectedBenchId, setSelectedBenchId] = useState<string | null>(null)

  // Small activation distance so a tap registers as a click (select) and only a real
  // drag starts a drag — important for touch.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

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
        const activePlayers = playersData.filter((p) => p.status === "active")
        setPlayers(activePlayers)
        setTeams({
          A: shapeFromPlayers(activePlayers, "A"),
          B: shapeFromPlayers(activePlayers, "B"),
        })
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [matchId])

  // ----- derived -----
  const assignedIds = new Set([...shapePlayers(teams.A), ...shapePlayers(teams.B)].map((p) => p.id))
  const unassignedPlayers = players.filter((p) => !assignedIds.has(p.id))
  const getTeamPlayers = (team: TeamSide) => shapePlayers(teams[team])
  const areAllAssigned = assignedIds.size === players.length && players.length > 0
  const assignedCount = assignedIds.size

  // ----- placement helpers -----
  const placeInBand = (team: TeamSide, band: BandId, fraction: number, player: PlayerWithDetails) => {
    setTeams((prev) => {
      const next: Teams = { A: cloneShape(prev.A), B: cloneShape(prev.B) }
      removeFromShape(next.A, player.id)
      removeFromShape(next.B, player.id)
      const arr = next[team][band]
      const idx = Math.max(0, Math.min(arr.length, Math.round(fraction * arr.length)))
      arr.splice(idx, 0, player)
      return next
    })
  }

  const unassign = (playerId: string) => {
    setTeams((prev) => {
      const next: Teams = { A: cloneShape(prev.A), B: cloneShape(prev.B) }
      removeFromShape(next.A, playerId)
      removeFromShape(next.B, playerId)
      return next
    })
  }

  // ----- drag handlers -----
  const handleDragStart = (event: DragStartEvent) => {
    setSelectedBenchId(null)
    setActivePlayer((event.active.data.current?.player as PlayerWithDetails) ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActivePlayer(null)
    if (!over) return

    const player = players.find((p) => p.id === active.id)
    if (!player) return

    const overId = String(over.id)
    if (overId === "bench") {
      unassign(player.id)
      return
    }

    const [teamStr, band] = overId.split(":")
    if (!teamStr || !band) return

    // Horizontal fraction of where the card landed -> insertion order (left/right control).
    const rect = over.rect
    const translated = active.rect.current.translated
    const centerX = translated ? translated.left + translated.width / 2 : rect.left + rect.width / 2
    const fraction = rect.width ? Math.max(0, Math.min(1, (centerX - rect.left) / rect.width)) : 0.5

    placeInBand(teamStr as TeamSide, band as BandId, fraction, player)
  }

  const handleTapBand = (team: TeamSide, band: BandId) => {
    if (!selectedBenchId) return
    const player = players.find((p) => p.id === selectedBenchId)
    if (!player) return
    placeInBand(team, band, 1, player) // append to the end of the line
    setSelectedBenchId(null)
  }

  // ----- toolbar actions -----
  const autoAssignPlayers = () => {
    const assignedA = shapePlayers(teams.A)
    const assignedB = shapePlayers(teams.B)
    const unassigned = players.filter((p) => !assignedIds.has(p.id))
    const { teamA, teamB } = balanceTeamsByPower(unassigned, assignedA, assignedB)
    setTeams({ A: autoShape(teamA), B: autoShape(teamB) })
    setSelectedBenchId(null)
  }

  const resetAssignments = () => {
    setTeams({ A: emptyShape(), B: emptyShape() })
    setSelectedBenchId(null)
  }

  const clearTeam = (team: TeamSide) => {
    setTeams((prev) => ({ ...prev, [team]: emptyShape() }))
    setSelectedBenchId(null)
  }

  const handleSavePositions = async () => {
    try {
      setSaving(true)
      const placements = [...shapeToPlacements(teams.A, "A"), ...shapeToPlacements(teams.B, "B")]
      const result = await saveTeamPositions(matchId, placements)
      if (result.success) {
        toast({ title: t("common.success"), description: t("organize.saved") })
      } else {
        toast({
          title: t("common.error"),
          description: result.error || t("organize.saveError"),
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error saving positions:", error)
      toast({ title: t("common.error"), description: t("organize.saveError"), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p>{t("common.loading")}</p>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-6">{t("error.matchNotFound")}</h1>
        <p className="mb-4">{t("error.matchNotFoundDesc")}</p>
        <Link href="/" passHref>
          <Button>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("common.backHome")}
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-10">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="container max-w-5xl mx-auto px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Link href={`/match/${matchId}`} passHref>
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold leading-tight truncate">{t("organize.pageTitle")}</h1>
              <p className="text-xs text-muted-foreground leading-tight">
                {t("organize.matchInfo", { date: formatMatchDate(match.date, locale), time: match.time })}
              </p>
            </div>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 shrink-0"
              onClick={handleSavePositions}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="ml-1.5">{t("common.save")}</span>
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="secondary" className="flex-1" onClick={autoAssignPlayers}>
              <Users className="mr-1.5 h-4 w-4" />
              {t("organize.autoAssign")}
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={resetAssignments}>
              {t("organize.reset")}
            </Button>
          </div>
        </div>
      </header>

      <div className="container max-w-5xl mx-auto px-3 pt-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Bench (unassigned) — drop here to remove a player from a team */}
          <BenchZone
            players={unassignedPlayers}
            selectedId={selectedBenchId}
            onToggle={(id) => setSelectedBenchId((prev) => (prev === id ? null : id))}
            t={t}
          />

          <p className="mb-3 text-center text-xs text-muted-foreground">{t("organize.tacticsHint")}</p>

          {/* Team formations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(["A", "B"] as const).map((team) => {
              const isA = team === "A"
              return (
                <Card
                  key={team}
                  className={`overflow-hidden ${isA ? "border-blue-200 dark:border-blue-900" : "border-red-200 dark:border-red-900"}`}
                >
                  <CardHeader className={`py-3 ${isA ? "bg-blue-50 dark:bg-blue-950/50" : "bg-red-50 dark:bg-red-950/50"}`}>
                    <CardTitle
                      className={`text-base flex items-center justify-between ${
                        isA ? "text-blue-700 dark:text-blue-300" : "text-red-700 dark:text-red-300"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{t(isA ? "team.a" : "team.b")}</span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                            isA
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200"
                              : "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200"
                          }`}
                        >
                          {formationString(teams[team])}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span
                          className={`text-xs font-medium ${
                            isA ? "text-blue-600/70 dark:text-blue-400/70" : "text-red-600/70 dark:text-red-400/70"
                          }`}
                        >
                          {getTeamPlayers(team).length}/8
                        </span>
                        {getTeamPlayers(team).length > 0 && (
                          <button
                            onClick={() => clearTeam(team)}
                            className="text-muted-foreground/70 hover:text-foreground"
                            aria-label={t("organize.clearTeam")}
                            title={t("organize.clearTeam")}
                          >
                            <Eraser className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <FormationPitch
                      team={team}
                      shape={teams[team]}
                      onRemovePlayer={unassign}
                      onTapBand={(band) => handleTapBand(team, band)}
                      selecting={!!selectedBenchId}
                    />
                  </CardContent>
                  {areAllAssigned ? (
                    <PlayStyleBar players={getTeamPlayers(team)} team={team} />
                  ) : (
                    <div className="px-4 pb-3 text-center text-xs text-muted-foreground">
                      {t("organize.playStylePlaceholder")}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>

          <DragOverlay>
            {activePlayer ? (
              <div className="w-[72px] rotate-3">
                <FifaCard
                  user={activePlayer}
                  compact
                  showName
                  className="rounded-lg overflow-hidden shadow-2xl ring-2 ring-white/70"
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Team Power Comparison */}
        {areAllAssigned ? (
          <div className="mt-4">
            <TeamPowerComparison teamAPlayers={getTeamPlayers("A")} teamBPlayers={getTeamPlayers("B")} />
          </div>
        ) : (
          <Card className="mt-4">
            <CardContent className="py-6">
              <div className="text-center text-muted-foreground">
                <Users className="mx-auto h-10 w-10 mb-3 opacity-50" />
                <h3 className="text-base font-medium mb-1">{t("organize.teamAnalysis")}</h3>
                <p className="text-sm">
                  {t("organize.powerAnalysisPlaceholder", { assigned: assignedCount, total: players.length })}
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

// Unassigned players strip; also a droppable "bench" so dragging a field card here removes it.
function BenchZone({
  players,
  selectedId,
  onToggle,
  t,
}: {
  players: PlayerWithDetails[]
  selectedId: string | null
  onToggle: (id: string) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "bench" })

  return (
    <Card className="mb-4 overflow-hidden">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <span>{t("organize.unassignedTitle")}</span>
          <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5">
            {players.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent ref={setNodeRef} className={`p-3 pt-0 transition-colors ${isOver ? "bg-primary/5" : ""}`}>
        {players.length === 0 ? (
          <div className="text-center py-3 text-sm text-muted-foreground">{t("organize.allAssigned")}</div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
            {players.map((player) => (
              <div key={player.id} className="w-[72px] sm:w-[84px] shrink-0 snap-start">
                <div
                  onClick={() => onToggle(player.id)}
                  className={`rounded-lg transition ${
                    selectedId === player.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                  }`}
                >
                  <PlayerCard player={player} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
