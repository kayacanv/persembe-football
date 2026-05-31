"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import {
  ArrowLeft,
  User,
  Lock,
  Trophy,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  BarChart3,
  History,
  UsersRound,
  Swords,
  UploadCloud,
  Edit3,
  Info,
  Eye,
  EyeOff,
  Minus,
  Star,
  CreditCard,
} from "lucide-react"
import Link from "next/link"
import {
  getUserById,
  updateUserPhoto,
  getPlayerMatchHistory,
  getPlayerStats,
  getPlayerTeammates,
  getUnpaidMatchesCount,
  updateUserCard,
} from "@/app/lib/profile-service"
import { setUserPhone } from "@/app/lib/data-service"
import { removeBackgroundToCutout } from "@/app/lib/storage-service"
import { getPlayerMvpCount } from "@/app/lib/mvp-service"
import type { User as UserType, PlayerMatchSummary, PlayerStats, TeammateStats } from "@/app/lib/types"
import FifaCard from "@/app/components/fifa-card/fifa-card"
import FifaCardEditor from "@/app/components/fifa-card/fifa-card-editor"
import { CountryPhoneInput } from "@/app/components/phone-input"
import { DEFAULT_DIAL, maskPhone, toE164 } from "@/app/lib/phone"
import { useTranslation } from "@/lib/i18n/useTranslation"

export default function PlayerProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useTranslation()
  const playerId = params.id as string

  // State
  const [user, setUser] = useState<UserType | null>(null)
  const [loading, setLoading] = useState(true)
  const [matchHistory, setMatchHistory] = useState<PlayerMatchSummary[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)
  const [teammates, setTeammates] = useState<TeammateStats[]>([])
  const [showPhotoInstructions, setShowPhotoInstructions] = useState(false)
  const [unpaidMatchesCount, setUnpaidMatchesCount] = useState(0)
  const [mvpCount, setMvpCount] = useState(0)

  // Contact form — write-only. We never pre-fill the stored number (profiles are
  // public): the field starts blank with the UK default, and a masked hint shows
  // whether a number is already on file.
  const [dial, setDial] = useState(DEFAULT_DIAL)
  const [national, setNational] = useState("")
  const [updatingContact, setUpdatingContact] = useState(false)

  // Photo upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [bgStatus, setBgStatus] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load player data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const userData = await getUserById(playerId)
        if (!userData) {
          toast({ title: t("common.error"), description: t("profile.playerNotFoundToast"), variant: "destructive" })
          router.push("/")
          return
        }
        setUser(userData)

        const [history, stats, teammatesData, unpaidCount, mvpAwards] = await Promise.all([
          getPlayerMatchHistory(playerId),
          getPlayerStats(playerId),
          getPlayerTeammates(playerId),
          getUnpaidMatchesCount(playerId),
          getPlayerMvpCount(playerId),
        ])
        setMatchHistory(history)
        setPlayerStats(stats)
        setTeammates(teammatesData)
        setUnpaidMatchesCount(unpaidCount)
        setMvpCount(mvpAwards)
      } catch (error) {
        console.error("Error loading player data:", error)
        toast({ title: t("common.error"), description: t("profile.dataLoadError"), variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [playerId, router])

  // Save/replace the player's phone in canonical E.164 (write-only — see state above).
  const handleSavePhone = async () => {
    if (!user) return
    const phone = toE164(dial, national)
    if (!phone) {
      toast({ title: t("common.error"), description: t("contact.errorPhoneRequired"), variant: "destructive" })
      return
    }
    try {
      setUpdatingContact(true)
      const res = await setUserPhone(playerId, phone)
      if (res.ok) {
        toast({ title: t("common.success"), description: t("profile.phoneSaved") })
        setUser((prev) => (prev ? { ...prev, phone } : null))
        setNational("") // keep the editor write-only
      } else {
        toast({
          title: t("common.error"),
          description: res.reason === "duplicate" ? t("contact.errorDuplicate") : t("profile.contactUpdateError"),
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error saving phone:", error)
      toast({ title: t("common.error"), description: t("profile.contactUpdateError"), variant: "destructive" })
    } finally {
      setUpdatingContact(false)
    }
  }

  // Handle file selection for photo upload
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0]
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: t("common.error"), description: t("profile.fileTooLarge"), variant: "destructive" })
        return
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        toast({
          title: t("common.error"),
          description: t("profile.invalidFormat"),
          variant: "destructive",
        })
        return
      }
      setSelectedFile(file)
    }
  }

  // Handle photo upload
  const handlePhotoUpload = async () => {
    if (!selectedFile || !user) return
    try {
      setUploadingPhoto(true)
      // Remove the background in-browser so the photo becomes a clean cutout that
      // composites into the live card. Falls back to the original file on failure.
      setBgStatus(t("profile.removingBg"))
      const cutout = await removeBackgroundToCutout(selectedFile, (_stage, ratio) => {
        setBgStatus(t("profile.removingBgProgress", { progress: Math.round(ratio * 100) }))
      })
      setBgStatus(t("profile.uploading"))
      const newPhotoUrl = await updateUserPhoto(user.id, cutout, user.photo_url)
      if (newPhotoUrl) {
        // A fresh cutout should composite into the live card, not be treated as a
        // pre-baked card image — clear the legacy baked flag.
        await updateUserCard(user.id, { card_baked: false })
        toast({ title: t("common.success"), description: t("profile.photoUpdated") })
        setUser((prev) => (prev ? { ...prev, photo_url: newPhotoUrl, card_baked: false } : null))
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
      } else {
        toast({ title: t("common.error"), description: t("profile.photoUploadError"), variant: "destructive" })
      }
    } catch (error) {
      console.error("Error uploading photo:", error)
      toast({ title: t("common.error"), description: t("profile.photoUploadError"), variant: "destructive" })
    } finally {
      setUploadingPhoto(false)
      setBgStatus(null)
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${date.getDate().toString().padStart(2, "0")}.${(date.getMonth() + 1).toString().padStart(2, "0")}.${date.getFullYear()}`
  }

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />
        <p className="text-lg">{t("profile.loading")}</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-6">{t("error.playerNotFoundTitle")}</h1>
        <p className="mb-4">{t("error.playerNotFoundDesc")}</p>
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
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <Link href="/" passHref>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("common.back")}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <div className="md:col-span-1 flex flex-col items-center">
          <div className="w-full max-w-[280px] mx-auto">
            <FifaCard user={user} />
          </div>
          <input
            type="file"
            accept="image/jpeg, image/png, image/webp"
            onChange={handleFileChange}
            className="hidden"
            ref={fileInputRef}
            id="photoUploadInput"
          />
          <Button
            variant="outline"
            className="mt-4 w-full max-w-[280px] bg-transparent"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
          >
            <Edit3 className="mr-2 h-4 w-4" /> {t("profile.changePhoto")}
          </Button>
          {selectedFile && (
            <Button
              onClick={handlePhotoUpload}
              disabled={uploadingPhoto}
              className="mt-2 w-full max-w-[280px] bg-green-600 hover:bg-green-700"
            >
              {uploadingPhoto ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {bgStatus ?? t("common.loading")}
                </>
              ) : (
                <>
                  <UploadCloud className="mr-2 h-4 w-4" />{" "}
                  {t("profile.uploadFile", { filename: selectedFile.name.substring(0, 20) })}
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            className="mb-4 w-full max-w-[280px] bg-transparent"
            onClick={() => setShowPhotoInstructions(!showPhotoInstructions)}
          >
            {showPhotoInstructions ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {showPhotoInstructions ? t("profile.hidePhotoTips") : t("profile.showPhotoTips")}
          </Button>
          {showPhotoInstructions && (
            <Card className="mb-6 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-blue-700 dark:text-blue-300 flex items-center">
                  <Info className="h-5 w-5 mr-2" />
                  {t("profile.photoTipsTitle")}
                </CardTitle>
                <CardDescription className="text-blue-600 dark:text-blue-400">
                  {t("profile.photoTipsDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                <div>
                  <strong className="block mb-1">{t("profile.tip1Heading")}</strong>
                  <p className="text-muted-foreground">{t("profile.tip1Text")}</p>
                </div>
                <div>
                  <strong className="block mb-1">{t("profile.tip2Heading")}</strong>
                  <p className="text-muted-foreground">{t("profile.tip2Text")}</p>
                </div>
                <div>
                  <strong className="block mb-1">{t("profile.tip3Heading")}</strong>
                  <p className="text-muted-foreground">{t("profile.tip3Text")}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="md:col-span-2">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">{user.name}</h1>
            <div className="flex items-center text-muted-foreground mt-1 flex-wrap gap-2">
              <Badge variant="outline" className="mr-2">
                {user.position || t("profile.noPosition")}
              </Badge>
              {user.confirmed ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> {t("profile.confirmed")}
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  {t("profile.unconfirmed")}
                </Badge>
              )}
              {unpaidMatchesCount > 0 && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  {t("profile.unpaidMatches", { count: unpaidMatchesCount })}
                </Badge>
              )}
            </div>
          </div>

          <Tabs defaultValue="card" className="w-full">
            <TabsList className="grid grid-cols-3 sm:grid-cols-5 mb-6">
              <TabsTrigger value="card">
                <CreditCard className="h-4 w-4 mr-1 sm:mr-2" />
                <span>{t("profile.tabCard")}</span>
              </TabsTrigger>
              <TabsTrigger value="stats">
                <BarChart3 className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">{t("profile.tabStatsFull")}</span>
                <span className="sm:hidden">{t("profile.tabStatsShort")}</span>
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">{t("profile.tabHistoryFull")}</span>
                <span className="sm:hidden">{t("profile.tabHistoryShort")}</span>
              </TabsTrigger>
              <TabsTrigger value="teammates">
                <UsersRound className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">{t("profile.tabRelationsFull")}</span>
                <span className="sm:hidden">{t("profile.tabRelationsShort")}</span>
              </TabsTrigger>
              <TabsTrigger value="profile">
                <User className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">{t("profile.tabProfile")}</span>
                <span className="sm:hidden">{t("profile.tabProfile")}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="card">
              <Card>
                <CardHeader>
                  <CardTitle>{t("profile.editCardTitle")}</CardTitle>
                  <CardDescription>{t("profile.editCardDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <FifaCardEditor
                    user={user}
                    onSaved={(updated) => setUser((prev) => (prev ? { ...prev, ...updated } : prev))}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats">
              <Card>
                <CardHeader>
                  <CardTitle>{t("profile.statsTitle")}</CardTitle>
                  <CardDescription>{t("profile.statsDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {playerStats ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center">
                          <div className="text-muted-foreground text-sm mb-1">{t("stats.totalMatches")}</div>
                          <div className="text-3xl font-bold">{playerStats.totalMatches}</div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                          <div className="text-green-600 dark:text-green-400 text-sm mb-1">{t("stats.wins")}</div>
                          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                            {playerStats.wins}
                          </div>
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg text-center">
                          <div className="text-yellow-600 dark:text-yellow-400 text-sm mb-1">{t("stats.draws")}</div>
                          <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                            {playerStats.draws}
                          </div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-center">
                          <div className="text-red-600 dark:text-red-400 text-sm mb-1">{t("stats.losses")}</div>
                          <div className="text-3xl font-bold text-red-600 dark:text-red-400">{playerStats.losses}</div>
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg text-center">
                          <div className="text-yellow-600 dark:text-yellow-400 text-sm mb-1 flex items-center justify-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" /> {t("stats.mvpAwards")}
                          </div>
                          <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{mvpCount}</div>
                        </div>
                      </div>
                      <div className="mt-6">
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium">{t("stats.winRate")}</span>
                          <span className="text-sm font-medium flex gap-2">
                            <span className="text-green-600">{playerStats.winRate}%</span>
                            <span className="text-yellow-500">
                              {((playerStats.draws / playerStats.totalMatches) * 100).toFixed(0)}%
                            </span>
                            <span className="text-red-600">
                              {((playerStats.losses / playerStats.totalMatches) * 100).toFixed(0)}%
                            </span>
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden flex">
                          <div
                            className="bg-green-600 h-2.5"
                            style={{ width: `${playerStats.winRate}%` }}
                            title={`${t("stats.winsColon")} ${playerStats.wins}`}
                          ></div>
                          <div
                            className="bg-yellow-500 h-2.5"
                            style={{ width: `${(playerStats.draws / playerStats.totalMatches) * 100}%` }}
                            title={`${t("stats.drawsColon")} ${playerStats.draws}`}
                          ></div>
                          <div
                            className="bg-red-600 h-2.5"
                            style={{ width: `${(playerStats.losses / playerStats.totalMatches) * 100}%` }}
                            title={`${t("stats.lossesColon")} ${playerStats.losses}`}
                          ></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                        <div className="border rounded-lg p-4">
                          <div className="text-sm font-medium text-blue-600 mb-2">{t("team.a")}</div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">{t("stats.matchesColon")}</span>
                            <span>{playerStats.teamAMatches}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">{t("stats.winsColon")}</span>
                            <span>{playerStats.teamAWins}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">{t("stats.drawsColon")}</span>
                            <span>{playerStats.teamADraws}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t("stats.ratio")}</span>
                            <span>{playerStats.teamAWinRate}%</span>
                          </div>
                        </div>
                        <div className="border rounded-lg p-4">
                          <div className="text-sm font-medium text-red-600 mb-2">{t("team.b")}</div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">{t("stats.matchesColon")}</span>
                            <span>{playerStats.teamBMatches}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">{t("stats.winsColon")}</span>
                            <span>{playerStats.teamBWins}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">{t("stats.drawsColon")}</span>
                            <span>{playerStats.teamBDraws}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t("stats.ratio")}</span>
                            <span>{playerStats.teamBWinRate}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">{t("stats.noStats")}</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>{t("profile.historyTitle")}</CardTitle>
                  <CardDescription>{t("profile.historyDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {matchHistory.length > 0 ? (
                    <div className="space-y-4">
                      {matchHistory.map((match) => (
                        <div key={match.matchId} className="border rounded-lg p-4">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 text-muted-foreground mr-2" />
                              <span>{match.date}</span>
                              <Clock className="h-4 w-4 text-muted-foreground ml-4 mr-2" />
                              <span>{match.time}</span>
                            </div>
                            <Link href={`/match/${match.matchId}`} passHref>
                              <Button variant="ghost" size="sm">
                                {t("common.details")}
                              </Button>
                            </Link>
                          </div>
                          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                            <div className="flex items-center flex-wrap gap-2">
                              <Badge
                                variant="outline"
                                className={
                                  match.team === "A"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                                }
                              >
                                {match.team === "A" ? t("team.a") : t("team.b")}
                              </Badge>
                              {match.result === "win" ? (
                                <Badge className="bg-green-500">
                                  <Trophy className="mr-1 h-3 w-3" /> {t("match.resultWin")}
                                </Badge>
                              ) : match.result === "draw" ? (
                                <Badge className="bg-yellow-500">
                                  <Minus className="mr-1 h-3 w-3" /> {t("match.resultDraw")}
                                </Badge>
                              ) : match.result === "loss" ? (
                                <Badge variant="destructive">
                                  <XCircle className="mr-1 h-3 w-3" /> {t("match.resultLoss")}
                                </Badge>
                              ) : (
                                <Badge variant="outline">{t("match.resultUnknown")}</Badge>
                              )}
                              {match.hasPaid ? (
                                <Badge className="bg-green-600">
                                  <CheckCircle2 className="mr-1 h-3 w-3" /> {t("payment.paid")}
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  <XCircle className="mr-1 h-3 w-3" /> {t("payment.unpaid")}
                                </Badge>
                              )}
                            </div>
                            {match.score && <span className="text-sm font-medium">{match.score}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">{t("profile.noMatchHistory")}</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="teammates">
              <Card>
                <CardHeader>
                  <CardTitle>{t("profile.teammatesTitle")}</CardTitle>
                  <CardDescription>{t("profile.teammatesDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {teammates.length > 0 ? (
                    <div className="space-y-4">
                      {teammates.map((teammate) => (
                        <div key={teammate.userId} className="border rounded-lg p-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                            <Link href={`/profile/${teammate.userId}`} className="hover:underline mb-2 sm:mb-0">
                              <div className="font-medium">{teammate.name}</div>
                            </Link>
                            <div className="flex space-x-2">
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <Users className="mr-1 h-3 w-3" />{" "}
                                {t("teammates.playedTogether", { count: teammate.matchesPlayedTogether })}
                              </Badge>
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                <Swords className="mr-1 h-3 w-3" />{" "}
                                {t("teammates.playedAgainst", { count: teammate.matchesPlayedAgainst })}
                              </Badge>
                            </div>
                          </div>
                          {teammate.matchesPlayedTogether > 0 && (
                            <div className="mt-3 pt-3 border-t border-dashed">
                              <div className="flex justify-between mb-1">
                                <span className="text-sm text-muted-foreground">{t("teammates.winRateTogether")}</span>
                                <span className="text-sm font-medium">{teammate.winRateTogether}%</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-green-600 h-2 rounded-full"
                                  style={{ width: `${teammate.winRateTogether}%` }}
                                ></div>
                              </div>
                              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                                <span>{t("teammates.winsTogether", { count: teammate.winsTogether })}</span>
                                <span>{t("teammates.lossesTogether", { count: teammate.lossesTogether })}</span>
                              </div>
                            </div>
                          )}
                          {teammate.matchesPlayedAgainst > 0 && (
                            <div className="mt-3 pt-3 border-t border-dashed">
                              <div className="flex justify-between mb-1">
                                <span className="text-sm text-muted-foreground">{t("teammates.winRateAgainst")}</span>
                                <span className="text-sm font-medium">{teammate.winRateAgainst}%</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-sky-500 h-2 rounded-full"
                                  style={{ width: `${teammate.winRateAgainst}%` }}
                                ></div>
                              </div>
                              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                                <span>{t("teammates.winsAgainst", { count: teammate.winsAgainst })}</span>
                                <span>{t("teammates.lossesAgainst", { count: teammate.lossesAgainst })}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">{t("profile.noTeammateData")}</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>{t("profile.contactTitle")}</CardTitle>
                  <CardDescription>{t("profile.contactDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Privacy note — numbers are never displayed anywhere on the site */}
                    <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                      <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{t("contact.privacyNote")}</span>
                    </div>

                    {maskPhone(user.phone) && (
                      <p className="text-sm text-muted-foreground">
                        {t("profile.numberOnFile", { masked: maskPhone(user.phone) as string })}
                      </p>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="phone">{t("common.phoneLabel")}</Label>
                      <CountryPhoneInput
                        id="phone"
                        dial={dial}
                        national={national}
                        onDialChange={setDial}
                        onNationalChange={setNational}
                        placeholder={t("common.phonePlaceholder")}
                        disabled={updatingContact}
                      />
                      <p className="text-xs text-muted-foreground">{t("contact.whatsappHint")}</p>
                      <p className="text-xs text-muted-foreground">{t("profile.phoneEditHint")}</p>
                    </div>

                    <Button
                      type="button"
                      onClick={handleSavePhone}
                      disabled={updatingContact || !national.trim()}
                      className="w-full mt-2"
                    >
                      {updatingContact ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.updating")}
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" /> {t("contact.saveButton")}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Toaster />
    </div>
  )
}
