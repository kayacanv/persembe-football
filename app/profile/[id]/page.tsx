"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
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
} from "lucide-react"
import Link from "next/link"
import {
  getUserById,
  updateUserProfile,
  updateUserPhoto,
  getPlayerMatchHistory,
  getPlayerStats,
  getPlayerTeammates,
  getUnpaidMatchesCount,
} from "@/app/lib/profile-service"
import type { User as UserType, PlayerMatchSummary, PlayerStats, TeammateStats } from "@/app/lib/types"
import PlayerPhotoCard from "@/app/components/player-photo-card"

export default function PlayerProfilePage() {
  const params = useParams()
  const router = useRouter()
  const playerId = params.id as string

  // State
  const [user, setUser] = useState<UserType | null>(null)
  const [loading, setLoading] = useState(true)
  const [matchHistory, setMatchHistory] = useState<PlayerMatchSummary[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)
  const [teammates, setTeammates] = useState<TeammateStats[]>([])
  const [showPhotoInstructions, setShowPhotoInstructions] = useState(false)
  const [unpaidMatchesCount, setUnpaidMatchesCount] = useState(0)

  // Form state
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [updatingContact, setUpdatingContact] = useState(false)

  // Photo upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load player data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const userData = await getUserById(playerId)
        if (!userData) {
          toast({ title: "Hata", description: "Oyuncu bulunamadı.", variant: "destructive" })
          router.push("/")
          return
        }
        setUser(userData)
        setPhone(userData.phone || "")
        setEmail(userData.email || "")

        const [history, stats, teammatesData, unpaidCount] = await Promise.all([
          getPlayerMatchHistory(playerId),
          getPlayerStats(playerId),
          getPlayerTeammates(playerId),
          getUnpaidMatchesCount(playerId),
        ])
        setMatchHistory(history)
        setPlayerStats(stats)
        setTeammates(teammatesData)
        setUnpaidMatchesCount(unpaidCount)
      } catch (error) {
        console.error("Error loading player data:", error)
        toast({ title: "Hata", description: "Veri yüklenirken bir hata oluştu.", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [playerId, router])

  // Handle contact info update
  const handleUpdateContact = async () => {
    if (!user) return
    try {
      setUpdatingContact(true)
      const success = await updateUserProfile(playerId, { phone, email })
      if (success) {
        toast({ title: "Başarılı", description: "İletişim bilgileri güncellendi." })
        setUser((prev) => (prev ? { ...prev, phone, email } : null))
      } else {
        toast({ title: "Hata", description: "Bilgiler güncellenirken bir hata oluştu.", variant: "destructive" })
      }
    } catch (error) {
      console.error("Error updating contact info:", error)
      toast({ title: "Hata", description: "Bilgiler güncellenirken bir hata oluştu.", variant: "destructive" })
    } finally {
      setUpdatingContact(false)
    }
  }

  // Handle file selection for photo upload
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0]
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Hata", description: "Dosya boyutu 5MB'den büyük olamaz.", variant: "destructive" })
        return
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        toast({
          title: "Hata",
          description: "Sadece JPG, PNG, veya WEBP formatında resim yükleyebilirsiniz.",
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
      const newPhotoUrl = await updateUserPhoto(user.id, selectedFile, user.photo_url)
      if (newPhotoUrl) {
        toast({ title: "Başarılı", description: "Profil fotoğrafı güncellendi." })
        setUser((prev) => (prev ? { ...prev, photo_url: newPhotoUrl } : null))
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
      } else {
        toast({ title: "Hata", description: "Fotoğraf yüklenirken bir hata oluştu.", variant: "destructive" })
      }
    } catch (error) {
      console.error("Error uploading photo:", error)
      toast({ title: "Hata", description: "Fotoğraf yüklenirken bir hata oluştu.", variant: "destructive" })
    } finally {
      setUploadingPhoto(false)
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${date.getDate().toString().padStart(2, "0")}.${(date.getMonth() + 1).toString().padStart(2, "0")}.${date.getFullYear()}`
  }

  // Check if a phone number is auto-generated
  const isAutoGeneratedPhone = (phone: string) => phone && phone.startsWith("no-phone-")

  // Format phone for display
  const formatPhoneForDisplay = (phone: string) => (isAutoGeneratedPhone(phone) ? "" : phone)

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />
        <p className="text-lg">Oyuncu profili yükleniyor...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-6">Oyuncu Bulunamadı</h1>
        <p className="mb-4">Belirtilen ID ile bir oyuncu bulunamadı.</p>
        <Link href="/" passHref>
          <Button>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Ana Sayfaya Dön
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
            Geri
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <div className="md:col-span-1 flex flex-col items-center">
          <PlayerPhotoCard
            name={user.name}
            photoUrl={user.photo_url}
            // Removed position, power, confirmed props as they are not needed by the simplified card
          />
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
            <Edit3 className="mr-2 h-4 w-4" /> Fotoğrafı Değiştir
          </Button>
          {selectedFile && (
            <Button
              onClick={handlePhotoUpload}
              disabled={uploadingPhoto}
              className="mt-2 w-full max-w-[280px] bg-green-600 hover:bg-green-700"
            >
              {uploadingPhoto ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Yükleniyor...
                </>
              ) : (
                <>
                  <UploadCloud className="mr-2 h-4 w-4" /> Yükle: {selectedFile.name.substring(0, 20)}...
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
            {showPhotoInstructions ? "Fotoğraf Talimatlarını Gizle" : "Fotoğraf Talimatlarını Göster"}
          </Button>
          {showPhotoInstructions && (
            <Card className="mb-6 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-blue-700 dark:text-blue-300 flex items-center">
                  <Info className="h-5 w-5 mr-2" />
                  Profil Fotoğrafı Hazırlama (FIFA Kart Stili)
                </CardTitle>
                <CardDescription className="text-blue-600 dark:text-blue-400">
                  Profil fotoğrafınızı FIFA (FC) oyuncu kartı formatında yükleyebilirsiniz. Aşağıdaki adımları izleyerek
                  kendi kartınızı oluşturun:
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                <div>
                  <strong className="block mb-1">Adım 1: Arka Planı Kaldırma</strong>
                  <p className="text-muted-foreground">
                    Fotoğrafınızın arka planını kaldırmak için{" "}
                    <a
                      href="https://www.remove.bg/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      remove.bg
                    </a>{" "}
                    sitesini ziyaret edin ve fotoğrafınızı yükleyerek arka planı temizlenmiş halini indirin.
                  </p>
                </div>
                <div>
                  <strong className="block mb-1">Adım 2: FIFA Kartı Oluşturma</strong>
                  <p className="text-muted-foreground">
                    Kendi oyuncu kartınızı tasarlamak için{" "}
                    <a
                      href="https://www.fut.gg/card-creator/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      FUT.GG Card Creator
                    </a>{" "}
                    adresine gidin. Arka planı kaldırılmış fotoğrafınızı kullanarak kartınızı oluşturun ve indirin.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    (İpucu: Kart boyutlarının yaklaşık 560x782 piksel olmasına dikkat edin.)
                  </p>
                </div>
                <div>
                  <strong className="block mb-1">Adım 3: Kartı Yükleme</strong>
                  <p className="text-muted-foreground">
                    Oluşturduğunuz ve indirdiğiniz FIFA kartını aşağıdaki "Fotoğrafı Değiştir" butonunu kullanarak
                    yükleyebilirsiniz.
                  </p>
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
                {user.position || "Pozisyon belirtilmemiş"}
              </Badge>
              {user.confirmed ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Onaylanmış
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  Onaylanmamış
                </Badge>
              )}
              {unpaidMatchesCount > 0 && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  {unpaidMatchesCount} Ödenmemiş Maç
                </Badge>
              )}
            </div>
          </div>

          <Tabs defaultValue="stats" className="w-full">
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 mb-6">
              <TabsTrigger value="stats">
                <BarChart3 className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">İstatistikler</span>
                <span className="sm:hidden">İst.</span>
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Maç Geçmişi</span>
                <span className="sm:hidden">Geçmiş</span>
              </TabsTrigger>
              <TabsTrigger value="teammates">
                <UsersRound className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Oyuncu İlişkileri</span>
                <span className="sm:hidden">İlişkiler</span>
              </TabsTrigger>
              <TabsTrigger value="profile">
                <User className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Profil</span>
                <span className="sm:hidden">Profil</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stats">
              <Card>
                <CardHeader>
                  <CardTitle>Oyuncu İstatistikleri</CardTitle>
                  <CardDescription>Toplam maç ve galibiyet istatistikleri</CardDescription>
                </CardHeader>
                <CardContent>
                  {playerStats ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center">
                          <div className="text-muted-foreground text-sm mb-1">Toplam Maç</div>
                          <div className="text-3xl font-bold">{playerStats.totalMatches}</div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                          <div className="text-green-600 dark:text-green-400 text-sm mb-1">Galibiyet</div>
                          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                            {playerStats.wins}
                          </div>
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg text-center">
                          <div className="text-yellow-600 dark:text-yellow-400 text-sm mb-1">Beraberlik</div>
                          <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                            {playerStats.draws}
                          </div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-center">
                          <div className="text-red-600 dark:text-red-400 text-sm mb-1">Mağlubiyet</div>
                          <div className="text-3xl font-bold text-red-600 dark:text-red-400">{playerStats.losses}</div>
                        </div>
                      </div>
                      <div className="mt-6">
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium">Galibiyet Oranı</span>
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
                            title={`Galip: ${playerStats.wins}`}
                          ></div>
                          <div
                            className="bg-yellow-500 h-2.5"
                            style={{ width: `${(playerStats.draws / playerStats.totalMatches) * 100}%` }}
                            title={`Beraberlik: ${playerStats.draws}`}
                          ></div>
                          <div
                            className="bg-red-600 h-2.5"
                            style={{ width: `${(playerStats.losses / playerStats.totalMatches) * 100}%` }}
                            title={`Mağlubiyet: ${playerStats.losses}`}
                          ></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                        <div className="border rounded-lg p-4">
                          <div className="text-sm font-medium text-blue-600 mb-2">Takım A</div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Maç:</span>
                            <span>{playerStats.teamAMatches}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Galibiyet:</span>
                            <span>{playerStats.teamAWins}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Beraberlik:</span>
                            <span>{playerStats.teamADraws}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Oran:</span>
                            <span>{playerStats.teamAWinRate}%</span>
                          </div>
                        </div>
                        <div className="border rounded-lg p-4">
                          <div className="text-sm font-medium text-red-600 mb-2">Takım B</div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Maç:</span>
                            <span>{playerStats.teamBMatches}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Galibiyet:</span>
                            <span>{playerStats.teamBWins}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Beraberlik:</span>
                            <span>{playerStats.teamBDraws}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Oran:</span>
                            <span>{playerStats.teamBWinRate}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">Henüz istatistik bulunmamaktadır.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Maç Geçmişi</CardTitle>
                  <CardDescription>Oyuncunun katıldığı maçlar ve sonuçları</CardDescription>
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
                                Detaylar
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
                                Takım {match.team}
                              </Badge>
                              {match.result === "win" ? (
                                <Badge className="bg-green-500">
                                  <Trophy className="mr-1 h-3 w-3" /> Galibiyet
                                </Badge>
                              ) : match.result === "draw" ? (
                                <Badge className="bg-yellow-500">
                                  <Minus className="mr-1 h-3 w-3" /> Beraberlik
                                </Badge>
                              ) : match.result === "loss" ? (
                                <Badge variant="destructive">
                                  <XCircle className="mr-1 h-3 w-3" /> Mağlubiyet
                                </Badge>
                              ) : (
                                <Badge variant="outline">Sonuçlanmadı</Badge>
                              )}
                              {match.hasPaid ? (
                                <Badge className="bg-green-600">
                                  <CheckCircle2 className="mr-1 h-3 w-3" /> Ödedi
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  <XCircle className="mr-1 h-3 w-3" /> Ödemedi
                                </Badge>
                              )}
                            </div>
                            {match.score && <span className="text-sm font-medium">{match.score}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">Henüz maç kaydı bulunmamaktadır.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="teammates">
              <Card>
                <CardHeader>
                  <CardTitle>Oyuncu İlişkileri</CardTitle>
                  <CardDescription>En çok birlikte ve karşılıklı oynadığı 5 oyuncu</CardDescription>
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
                                <Users className="mr-1 h-3 w-3" /> {teammate.matchesPlayedTogether} Birlikte
                              </Badge>
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                <Swords className="mr-1 h-3 w-3" /> {teammate.matchesPlayedAgainst} Karşılıklı
                              </Badge>
                            </div>
                          </div>
                          {teammate.matchesPlayedTogether > 0 && (
                            <div className="mt-3 pt-3 border-t border-dashed">
                              <div className="flex justify-between mb-1">
                                <span className="text-sm text-muted-foreground">Birlikte Galibiyet Oranı</span>
                                <span className="text-sm font-medium">{teammate.winRateTogether}%</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-green-600 h-2 rounded-full"
                                  style={{ width: `${teammate.winRateTogether}%` }}
                                ></div>
                              </div>
                              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                                <span>{teammate.winsTogether} Birlikte G</span>
                                <span>{teammate.lossesTogether} Birlikte M</span>
                              </div>
                            </div>
                          )}
                          {teammate.matchesPlayedAgainst > 0 && (
                            <div className="mt-3 pt-3 border-t border-dashed">
                              <div className="flex justify-between mb-1">
                                <span className="text-sm text-muted-foreground">Karşılıklı Galibiyet Oranı</span>
                                <span className="text-sm font-medium">{teammate.winRateAgainst}%</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-sky-500 h-2 rounded-full"
                                  style={{ width: `${teammate.winRateAgainst}%` }}
                                ></div>
                              </div>
                              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                                <span>{teammate.winsAgainst} Karşılıklı G</span>
                                <span>{teammate.lossesAgainst} Karşılıklı M</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">Henüz yeterli veri bulunmamaktadır.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>İletişim Bilgileri</CardTitle>
                  <CardDescription>Kişisel bilgilerinizi güncelleyin</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefon Numarası</Label>
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 text-muted-foreground mr-2" />
                        <Input
                          id="phone"
                          value={formatPhoneForDisplay(phone)}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="5XX XXX XX XX"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-posta Adresi</Label>
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 text-muted-foreground mr-2" />
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="ornek@email.com"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={handleUpdateContact}
                      disabled={updatingContact}
                      className="w-full mt-4"
                    >
                      {updatingContact ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Güncelleniyor...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" /> Bilgileri Güncelle
                        </>
                      )}
                    </Button>
                  </form>
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
