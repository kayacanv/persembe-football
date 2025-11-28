"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Clock, ArrowRight, Plus, Users, BarChart3, Loader2 } from "lucide-react"
import {
  getActiveMatch,
  getPastMatches,
  createNextThursdayMatch,
  getAllPlayerStats,
  getNextThursday,
} from "./lib/data-service"
import type { Match, PlayerRankingStats } from "./lib/types"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
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

export default function HomePage() {
  const [activeMatch, setActiveMatch] = useState<Match | null>(null)
  const [pastMatches, setPastMatches] = useState<Match[]>([])
  const [playerRankings, setPlayerRankings] = useState<PlayerRankingStats[]>([])
  const [loadingMatches, setLoadingMatches] = useState(true)
  const [loadingRankings, setLoadingRankings] = useState(true)

  // Add state for price input and dialog
  const [createMatchDialogOpen, setCreateMatchDialogOpen] = useState(false)
  const [matchPrice, setMatchPrice] = useState(7.5)
  const [creatingMatch, setCreatingMatch] = useState(false)

  const searchParams = useSearchParams()
  const isAdmin = searchParams.get("admin") === "true"

  // Function to format date in readable Turkish format
  const formatReadableDate = (dateString: string) => {
    try {
      // Parse DD.MM.YYYY format
      const [day, month, year] = dateString.split(".")
      const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day))

      const months = [
        "Ocak",
        "Şubat",
        "Mart",
        "Nisan",
        "Mayıs",
        "Haziran",
        "Temmuz",
        "Ağustos",
        "Eylül",
        "Ekim",
        "Kasım",
        "Aralık",
      ]

      return `${Number.parseInt(day)} ${months[date.getMonth()]}`
    } catch (error) {
      return dateString // Fallback to original format if parsing fails
    }
  }

  useEffect(() => {
    async function loadData() {
      try {
        setLoadingMatches(true)
        setLoadingRankings(true)

        const supabase = getSupabaseBrowserClient()
        if (!supabase) {
          console.error("Supabase client is not initialized")
          toast({
            title: "Bağlantı Hatası",
            description: "Veritabanı bağlantısı kurulamadı. Lütfen daha sonra tekrar deneyin.",
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
      } catch (error) {
        console.error("Error loading data:", error)
        toast({
          title: "Hata",
          description: "Veri yüklenirken bir hata oluştu.",
          variant: "destructive",
        })
      } finally {
        setLoadingMatches(false)
        setLoadingRankings(false)
      }
    }

    loadData()
  }, [])

  // Update the handleCreateMatch function
  const handleCreateMatch = async () => {
    try {
      setCreatingMatch(true)
      const newMatch = await createNextThursdayMatch(matchPrice)
      if (newMatch) {
        setActiveMatch(newMatch)
        setCreateMatchDialogOpen(false)
        toast({
          title: "Başarılı",
          description: "Yeni maç oluşturuldu.",
        })
      }
    } catch (error) {
      console.error("Error creating match:", error)
      toast({
        title: "Hata",
        description: "Maç oluşturulurken bir hata oluştu.",
        variant: "destructive",
      })
    } finally {
      setCreatingMatch(false)
    }
  }

  return (
    <div className="container max-w-md mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-center">Perşembe Halısaha</h1>

      <Tabs defaultValue="matches" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="matches">
            <Calendar className="mr-2 h-4 w-4" /> Maçlar
          </TabsTrigger>
          <TabsTrigger value="rankings">
            <BarChart3 className="mr-2 h-4 w-4" /> Oyuncu Sıralaması
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matches">
          {/* Active Match */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Aktif Maç</h2>
            {loadingMatches ? (
              <Card className="mb-4">
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                  <div>Yükleniyor...</div>
                </CardContent>
              </Card>
            ) : activeMatch ? (
              <Card className="mb-4">
                <CardHeader className="pb-2">
                  <CardTitle>{formatReadableDate(activeMatch.date)}</CardTitle>
                  <CardDescription>
                    {activeMatch.status === "registering" ? "Kayıt aşamasında" : "Takımlar hazırlanıyor"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center mb-4">
                    <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{activeMatch.time}</span>
                  </div>
                  <Link href={`/match/${activeMatch.id}`} passHref>
                    <Button className="w-full">
                      Maça Git
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card className="mb-4">
                <CardContent className="p-6 text-center">
                  <p className="mb-4 text-muted-foreground">Aktif maç bulunmamaktadır.</p>
                  {isAdmin && (
                    <Button onClick={() => setCreateMatchDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Yeni Maç Oluştur
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Match History */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Geçmiş Maçlar</h2>
            {loadingMatches ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                  <div>Yükleniyor...</div>
                </CardContent>
              </Card>
            ) : pastMatches.length > 0 ? (
              <div className="space-y-4">
                {pastMatches.map((match) => (
                  <Card key={match.id}>
                    <CardHeader className="pb-2">
                      <CardTitle>{formatReadableDate(match.date)}</CardTitle>
                      <CardDescription>
                        Skor: {match.score_a ?? 0} - {match.score_b ?? 0}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <Link href={`/match/${match.id}`} passHref>
                        <Button variant="outline" className="w-full bg-transparent">
                          Detayları Gör
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
                  Henüz tamamlanmış maç bulunmamaktadır.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="rankings">
          <Card>
            <CardHeader>
              <CardTitle>Oyuncu Sıralaması</CardTitle>
              <CardDescription>En az 2 maça katılmış oyuncuların galibiyet oranına göre sıralaması.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRankings ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                  <div>Sıralama yükleniyor...</div>
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
                                  title={`${player.wins} Galibiyet`}
                                />
                              )}
                              {drawRate > 0 && (
                                <div
                                  className="bg-yellow-500 h-full"
                                  style={{ width: `${drawRate}%` }}
                                  title={`${player.draws} Beraberlik`}
                                />
                              )}
                              {lossRate > 0 && (
                                <div
                                  className="bg-red-500 h-full"
                                  style={{ width: `${lossRate}%` }}
                                  title={`${player.losses} Yenilgi`}
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
                            {player.wins}G - {player.draws}B - {player.losses}Y
                          </div>
                          <div className="text-xs text-muted-foreground">{player.totalMatches} Maç</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  Sıralama için yeterli veri bulunmamaktadır.
                  <br />
                  (En az 2 maç yapmış oyuncular listelenir.)
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {/* Create Match Dialog */}
      <Dialog open={createMatchDialogOpen} onOpenChange={setCreateMatchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Maç Oluştur</DialogTitle>
            <DialogDescription>{getNextThursday()} tarihli yeni bir Perşembe maçı oluşturun.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="match-price">Maç Ücreti (£)</Label>
              <Input
                id="match-price"
                type="number"
                step="0.50"
                min="0"
                value={matchPrice}
                onChange={(e) => setMatchPrice(Number.parseFloat(e.target.value) || 0)}
                placeholder="7.50"
              />
              <p className="text-xs text-muted-foreground">
                Varsayılan ücret £7.50'dir. İhtiyaç durumunda değiştirebilirsiniz.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateMatchDialogOpen(false)} disabled={creatingMatch}>
              İptal
            </Button>
            <Button onClick={handleCreateMatch} disabled={creatingMatch || matchPrice <= 0}>
              {creatingMatch ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Oluşturuluyor...
                </>
              ) : (
                "Maç Oluştur"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  )
}
