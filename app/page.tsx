"use client"

import { Toaster } from "@/components/ui/sonner"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Calendar,
  Clock,
  ArrowRight,
  Plus,
  Users,
  BarChart3,
  Loader2,
  AlertCircle,
  Star,
  Phone,
  KeyRound,
  PiggyBank as PiggyIcon,
} from "lucide-react"
import {
  getActiveMatch,
  getPastMatches,
  createNextThursdayMatch,
  getAllPlayerStats,
  getNextThursday,
  getUnpaidPlayerCount, // Import new function
} from "./lib/data-service"
import { getMvpWinnersForMatches, getVotingWindow } from "./lib/mvp-service"
import { getPiggyTotals, formatPounds } from "./lib/piggy-service"
import { ACTIVE_PIGGY } from "./config/piggy"
import type { Match, MvpWinner, PlayerRankingStats } from "./lib/types"
import { toast } from "@/components/ui/use-toast"
import { getSupabaseBrowserClient } from "./lib/supabase-browser"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { formatMatchDate } from "@/lib/i18n/format"
import { LanguageSwitcher } from "@/app/components/language-switcher"
import { PhoneRegistration } from "@/app/components/phone-registration"
import { AccountPanel } from "@/app/components/account-panel"
import { AuthBadge } from "@/app/components/auth-badge"

const TAB_VALUES = ["matches", "rankings", "contact", "account"] as const

export default function HomePage() {
  const { t, locale } = useTranslation()
  const [activeMatch, setActiveMatch] = useState<Match | null>(null)
  const [pastMatches, setPastMatches] = useState<Match[]>([])
  const [playerRankings, setPlayerRankings] = useState<PlayerRankingStats[]>([])
  const [loadingMatches, setLoadingMatches] = useState(true)
  const [loadingRankings, setLoadingRankings] = useState(true)
  const [unpaidCounts, setUnpaidCounts] = useState<Record<string, number>>({})
  const [mvpWinners, setMvpWinners] = useState<Record<string, MvpWinner>>({})
  const [piggy, setPiggy] = useState<{ remaining: number; progress: number; reached: boolean } | null>(null)

  // Add state for price input and dialog
  const [createMatchDialogOpen, setCreateMatchDialogOpen] = useState(false)
  const [matchPrice, setMatchPrice] = useState(10)
  const [creatingMatch, setCreatingMatch] = useState(false)

  const searchParams = useSearchParams()
  const isAdmin = searchParams.get("admin") === "true"

  // Tab is controlled so it can be opened directly via URL, e.g. ?tab=contact
  const tabParam = searchParams.get("tab")
  const [activeTab, setActiveTab] = useState<string>(
    TAB_VALUES.includes(tabParam as (typeof TAB_VALUES)[number]) ? (tabParam as string) : "matches",
  )

  useEffect(() => {
    async function loadData() {
      try {
        setLoadingMatches(true)
        setLoadingRankings(true)

        const supabase = getSupabaseBrowserClient()
        if (!supabase) {
          console.error("Supabase client is not initialized")
          toast({
            title: t("home.connectionError"),
            description: t("home.dbConnectionFailed"),
            variant: "destructive",
          })
          setLoadingMatches(false)
          setLoadingRankings(false)
          return
        }

        const [active, past, rankings] = await Promise.all([
          getActiveMatch(),
          getPastMatches(),
          getAllPlayerStats(2), // Minimum 2 matches
        ])

        setActiveMatch(active)
        setPastMatches(past)
        setPlayerRankings(rankings)

        // Kumbara banner. Non-blocking: a failure here must not break the home page.
        if (ACTIVE_PIGGY.active) {
          getPiggyTotals()
            .then((totals) =>
              setPiggy({
                remaining: totals.remainingMinor,
                progress: totals.progress,
                reached: totals.reached,
              }),
            )
            .catch((err) => console.error("Piggy totals failed:", err))
        }

        const allMatches = [active, ...past].filter(Boolean) as Match[]
        const counts: Record<string, number> = {}
        await Promise.all(
          allMatches.map(async (match) => {
            const count = await getUnpaidPlayerCount(match.id)
            counts[match.id] = count
          }),
        )
        setUnpaidCounts(counts)

        // MVP winners — only for matches whose voting window has closed, so the
        // badge shows a final result rather than a provisional leader.
        const closedPast = past.filter((m) => getVotingWindow(m).isClosed)
        const winners = await getMvpWinnersForMatches(closedPast.map((m) => m.id))
        setMvpWinners(Object.fromEntries(winners))
      } catch (error) {
        console.error("Error loading data:", error)
        toast({
          title: t("common.error"),
          description: t("home.dataLoadFailed"),
          variant: "destructive",
        })
      } finally {
        setLoadingMatches(false)
        setLoadingRankings(false)
      }
    }

    loadData()
  }, [t])

  // Update the handleCreateMatch function
  const handleCreateMatch = async () => {
    try {
      setCreatingMatch(true)
      const newMatch = await createNextThursdayMatch(matchPrice)
      if (newMatch) {
        setActiveMatch(newMatch)
        setCreateMatchDialogOpen(false)
        toast({
          title: t("common.success"),
          description: t("home.matchCreated"),
        })
      } else {
        // createMatch returns null on failure — most likely the unique date
        // constraint (a match for that Thursday already exists).
        toast({
          title: t("home.matchCreateFailed"),
          description: t("home.matchAlreadyExists", { date: getNextThursday() }),
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error creating match:", error)
      toast({
        title: t("common.error"),
        description: t("home.matchCreationError"),
        variant: "destructive",
      })
    } finally {
      setCreatingMatch(false)
    }
  }

  return (
    <div className="container max-w-md mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">Perşembe Halısaha</h1>
        <div className="flex items-center gap-2">
          <AuthBadge onSelect={() => setActiveTab("account")} />
          <LanguageSwitcher />
        </div>
      </div>

      {/* Kumbara — shown above the tabs so an open whip-round is impossible to miss. */}
      {piggy && (
        <Link href="/kumbara" className="block mb-6">
          <Card className="border-pink-300 bg-gradient-to-r from-pink-50 to-amber-50 transition-colors hover:border-pink-400 dark:border-pink-800 dark:from-pink-950/40 dark:to-amber-950/20">
            <CardContent className="flex items-center gap-3 p-4">
              <PiggyIcon className="h-8 w-8 shrink-0 text-pink-500" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t("piggy.bannerTitle")}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {piggy.reached
                    ? t("piggy.bannerDone")
                    : t("piggy.bannerRemaining", { amount: formatPounds(piggy.remaining).replace("£", "") })}
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-pink-200 dark:bg-pink-950">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-[width] duration-700"
                    style={{ width: `${piggy.progress * 100}%` }}
                  />
                </div>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="matches">
            <Calendar className="mr-1 h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t("home.tabMatches")}</span>
            <span className="sm:hidden">{t("home.tabMatchesShort")}</span>
          </TabsTrigger>
          <TabsTrigger value="rankings">
            <BarChart3 className="mr-1 h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t("home.tabRankings")}</span>
            <span className="sm:hidden">{t("home.tabRankingsShort")}</span>
          </TabsTrigger>
          <TabsTrigger value="contact">
            <Phone className="mr-1 h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t("home.tabContact")}</span>
            <span className="sm:hidden">{t("home.tabContactShort")}</span>
          </TabsTrigger>
          <TabsTrigger value="account">
            <KeyRound className="mr-1 h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t("home.tabAccount")}</span>
            <span className="sm:hidden">{t("home.tabAccountShort")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matches">
          {/* Active Match */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">{t("home.activeMatch")}</h2>
            {loadingMatches ? (
              <Card className="mb-4">
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                  <div>{t("common.loading")}</div>
                </CardContent>
              </Card>
            ) : activeMatch ? (
              <Card className="mb-4 relative">
                {unpaidCounts[activeMatch.id] > 0 && (
                  <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                    <AlertCircle className="h-3 w-3" />
                    {t("home.unpaidCount", { count: unpaidCounts[activeMatch.id] })}
                  </div>
                )}
                <CardHeader className="pb-2">
                  <CardTitle>{formatMatchDate(activeMatch.date, locale)}</CardTitle>
                  <CardDescription>
                    {activeMatch.status === "registering"
                      ? t("match.statusRegistering")
                      : t("match.statusReady")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center mb-4">
                    <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{activeMatch.time}</span>
                  </div>
                  <Link href={`/match/${activeMatch.id}`} passHref>
                    <Button className="w-full">
                      {t("home.goToMatch")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card className="mb-4">
                <CardContent className="p-6 text-center">
                  <p className="mb-4 text-muted-foreground">{t("home.noActiveMatch")}</p>
                  {isAdmin && (
                    <Button onClick={() => setCreateMatchDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t("home.createMatch")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Match History */}
          <div>
            <h2 className="text-xl font-semibold mb-4">{t("home.pastMatches")}</h2>
            {loadingMatches ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                  <div>{t("common.loading")}</div>
                </CardContent>
              </Card>
            ) : pastMatches.length > 0 ? (
              <div className="space-y-4">
                {pastMatches.map((match) => (
                  <Card key={match.id} className="relative">
                    {unpaidCounts[match.id] > 0 && (
                      <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                        <AlertCircle className="h-3 w-3" />
                        {t("home.unpaidCount", { count: unpaidCounts[match.id] })}
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <CardTitle>{formatMatchDate(match.date, locale)}</CardTitle>
                      <CardDescription>
                        {t("home.score", { a: match.score_a ?? 0, b: match.score_b ?? 0 })}
                      </CardDescription>
                      {mvpWinners[match.id] && (
                        <div className="mt-1 flex items-center gap-1 text-sm font-medium text-yellow-600">
                          <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                          {t("home.mvpBadge", { name: mvpWinners[match.id].name })}
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="pt-4">
                      <Link href={`/match/${match.id}`} passHref>
                        <Button variant="outline" className="w-full bg-transparent">
                          {t("home.seeDetails")}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-4 text-center text-muted-foreground">
                  {t("home.noPastMatches")}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="rankings">
          <Card>
            <CardHeader>
              <CardTitle>{t("home.rankingsTitle")}</CardTitle>
              <CardDescription>{t("home.rankingsDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRankings ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                  <div>{t("home.rankingsLoading")}</div>
                </div>
              ) : playerRankings.length > 0 ? (
                <div className="space-y-4">
                  {playerRankings.map((player, index) => {
                    const totalMatches = player.totalMatches || 1
                    const winRate = (player.wins / totalMatches) * 100 || 0
                    const drawRate = (player.draws / totalMatches) * 100 || 0
                    const lossRate = (player.losses / totalMatches) * 100 || 0

                    return (
                      <div
                        key={player.userId}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <span className="text-sm font-medium mr-3 text-muted-foreground w-6 text-center">
                              {index + 1}.
                            </span>
                            <Link href={`/profile/${player.userId}`} className="hover:underline">
                              <span className="font-medium">{player.name}</span>
                            </Link>
                          </div>
                          <div className="flex items-center gap-2 ml-9">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden flex">
                              {winRate > 0 && (
                                <div
                                  className="bg-green-500 h-full"
                                  style={{ width: `${winRate}%` }}
                                  title={t("stats.winsTooltip", { count: player.wins })}
                                />
                              )}
                              {drawRate > 0 && (
                                <div
                                  className="bg-yellow-500 h-full"
                                  style={{ width: `${drawRate}%` }}
                                  title={t("stats.drawsTooltip", { count: player.draws })}
                                />
                              )}
                              {lossRate > 0 && (
                                <div
                                  className="bg-red-500 h-full"
                                  style={{ width: `${lossRate}%` }}
                                  title={t("stats.lossesTooltip", { count: player.losses })}
                                />
                              )}
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground w-12 text-right">
                              {player.winRate}%
                            </span>
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <div className="text-sm font-semibold text-primary">
                            {t("home.recordFormat", {
                              wins: player.wins,
                              draws: player.draws,
                              losses: player.losses,
                            })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("home.matchesCount", { count: player.totalMatches })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  {t("home.rankingsEmpty")}
                  <br />
                  {t("home.rankingsEmptyHint")}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact">
          <PhoneRegistration />
        </TabsContent>

        <TabsContent value="account">
          <AccountPanel />
        </TabsContent>
      </Tabs>
      {/* Create Match Dialog */}
      <Dialog open={createMatchDialogOpen} onOpenChange={setCreateMatchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("home.createMatch")}</DialogTitle>
            <DialogDescription>{t("home.createDialogDesc", { date: getNextThursday() })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="match-price">{t("home.priceLabel")}</Label>
              <Input
                id="match-price"
                type="number"
                step="0.50"
                min="0"
                value={matchPrice}
                onChange={(e) => setMatchPrice(Number.parseFloat(e.target.value) || 0)}
                placeholder="10.00"
              />
              <p className="text-xs text-muted-foreground">{t("home.priceHelp")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateMatchDialogOpen(false)} disabled={creatingMatch}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCreateMatch} disabled={creatingMatch || matchPrice <= 0}>
              {creatingMatch ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.creating")}
                </>
              ) : (
                t("home.createButton")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  )
}
