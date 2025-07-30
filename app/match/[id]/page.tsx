"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Check,
  X,
  ChevronDown,
  Clock,
  Users,
  ArrowLeft,
  Trash2,
  Loader2,
  Info,
  AlertTriangle,
  XCircle,
  Clock3,
  ExternalLink,
  CreditCard,
  Save,
  UserPlus,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import type { Match, MatchStatus, PlayerWithDetails } from "@/app/lib/types"
import {
  getMatchById,
  getPlayersForMatch,
  updateMatchStatus,
  registerPlayerForMatch,
  removePlayerFromMatch,
  confirmUser,
  getAllUsers,
  cancelPlayerRegistration,
  getActivePlayerCount,
} from "@/app/lib/data-service"
import Link from "next/link"
import { createCheckoutSession, verifyPaymentStatus, confirmManualPayment } from "@/app/actions/stripe-actions"
import { updateMatchScore } from "@/app/actions/match-actions"
import { getStripe } from "@/app/lib/stripe"
import type { User as UserType } from "@/app/lib/types"
import { format, formatDistanceToNow } from "date-fns"
import { tr } from "date-fns/locale"
import { PlayerNameAutocomplete } from "@/app/components/player-name-autocomplete"
import { Textarea } from "@/components/ui/textarea"

export default function MatchPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAdmin = searchParams.get("admin") === "true"
  const matchId = params.id

  // State
  const [match, setMatch] = useState<Match | null>(null)
  const [players, setPlayers] = useState<PlayerWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [allUsers, setAllUsers] = useState<UserType[]>([])
  const [activePlayerCount, setActivePlayerCount] = useState(0)

  // Bulk add state
  const [bulkAddDialogOpen, setBulkAddDialogOpen] = useState(false)
  const [bulkAddText, setBulkAddText] = useState("")
  const [bulkAdding, setBulkAdding] = useState(false)
  interface BulkAddResult {
    added: UserType[]
    alreadyRegistered: string[]
    notFound: string[]
  }
  const [bulkAddResult, setBulkAddResult] = useState<BulkAddResult | null>(null)

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

  // Score state
  const [scoreA, setScoreA] = useState<number | undefined>(undefined)
  const [scoreB, setScoreB] = useState<number | undefined>(undefined)
  const [savingScore, setSavingScore] = useState(false)

  // Registration state
  const [name, setName] = useState("")
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Delete player dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [playerToDelete, setPlayerToDelete] = useState<PlayerWithDetails | null>(null)
  const [verificationPhone, setVerificationPhone] = useState("")
  const [deleting, setDeleting] = useState(false)

  // Cancel registration dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [playerToCancel, setPlayerToCancel] = useState<PlayerWithDetails | null>(null)
  const [canceling, setCanceling] = useState(false)

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [playerToPay, setPlayerToPay] = useState<PlayerWithDetails | null>(null)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "revolut">("revolut")
  const [paidWithRevolut, setPaidWithRevolut] = useState(false)
  const [confirmingManualPayment, setConfirmingManualPayment] = useState(false)

  // Add state for the confirmation dialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [userToConfirm, setUserToConfirm] = useState<PlayerWithDetails | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Payment status check state
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null)
  const [paymentCanceled, setPaymentCanceled] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Load match and players data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const matchData = await getMatchById(matchId)
        if (!matchData) {
          toast({
            title: "Hata",
            description: "Maç bulunamadı.",
            variant: "destructive",
          })
          return
        }

        setMatch(matchData)
        setScoreA(matchData.score_a ?? 0)
        setScoreB(matchData.score_b ?? 0)

        const playersData = await getPlayersForMatch(matchId)
        setPlayers(playersData)

        const activeCount = await getActivePlayerCount(matchId)
        setActivePlayerCount(activeCount)

        // Load all users for autocomplete
        const users = await getAllUsers()
        setAllUsers(users)
      } catch (error) {
        console.error("Error loading match data:", error)
        toast({
          title: "Hata",
          description: "Veri yüklenirken bir hata oluştu.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [matchId])

  // Get payment status from URL parameters
  useEffect(() => {
    setPaymentSuccess(searchParams.get("payment_success"))
    setPaymentCanceled(searchParams.get("payment_canceled"))
    setSessionId(searchParams.get("session_id"))
  }, [searchParams])

  // Check payment status from URL parameters
  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (paymentSuccess === "true" && sessionId) {
        const { success } = await verifyPaymentStatus(sessionId)

        if (success) {
          toast({
            title: "Başarılı",
            description: "Ödemeniz başarıyla alındı.",
          })

          // Refresh players list
          const updatedPlayers = await getPlayersForMatch(matchId)
          setPlayers(updatedPlayers)
        }
      } else if (paymentCanceled === "true") {
        toast({
          title: "İptal",
          description: "Ödeme işlemi iptal edildi.",
        })
      }
    }

    checkPaymentStatus()
  }, [paymentSuccess, paymentCanceled, sessionId, matchId])

  // Check if a user is already registered for this match
  const isUserRegistered = (userName: string) => {
    return players.some(
      (player) => player.name.toLowerCase() === userName.toLowerCase() && player.status !== "canceled",
    )
  }

  // Handle user selection from autocomplete
  const handleUserSelect = (user: UserType) => {
    setSelectedUser(user)
  }

  // Handle registration
  const handleRegister = async () => {
    if (!name) {
      toast({
        title: "Hata",
        description: "İsim alanı gereklidir.",
        variant: "destructive",
      })
      return
    }

    // Check if the user is already registered for this match
    if (isUserRegistered(name)) {
      toast({
        title: "Bilgi",
        description: `${name} zaten bu maça kayıtlı.`,
      })
      return
    }

    try {
      setSubmitting(true)

      // If a user was selected from autocomplete, use that user's data
      if (selectedUser) {
        const success = await registerPlayerForMatch(
          matchId,
          selectedUser.name,
          selectedUser.phone,
          selectedUser.position || "",
        )

        if (success) {
          handleRegistrationSuccess()
        } else {
          handleRegistrationError()
        }
      } else {
        // Check if a user with the same name already exists
        const existingUser = allUsers.find((user) => user.name.toLowerCase() === name.toLowerCase())

        if (existingUser) {
          // Use existing user data
          const success = await registerPlayerForMatch(
            matchId,
            existingUser.name,
            existingUser.phone,
            existingUser.position || "",
          )

          if (success) {
            handleRegistrationSuccess()
          } else {
            handleRegistrationError()
          }
        } else {
          // Create a new user
          const success = await registerPlayerForMatch(matchId, name, null, "")

          if (success) {
            handleRegistrationSuccess()
          } else {
            handleRegistrationError()
          }
        }
      }
    } catch (error) {
      console.error("Error registering player:", error)
      handleRegistrationError()
    } finally {
      setSubmitting(false)
    }
  }

  // Handle successful registration
  const handleRegistrationSuccess = async () => {
    // Check if the player was added to the waitlist
    const updatedActiveCount = await getActivePlayerCount(matchId)
    setActivePlayerCount(updatedActiveCount)

    const isWaitlisted = updatedActiveCount > 16

    toast({
      title: "Başarılı",
      description: isWaitlisted ? "Bekleme listesine eklendiniz." : "Kaydınız alınmıştır.",
    })

    // Refresh players list
    const updatedPlayers = await getPlayersForMatch(matchId)
    setPlayers(updatedPlayers)

    // Reset form
    setName("")
    setSelectedUser(null)

    // Refresh the user list to include the new user if one was created
    const updatedUsers = await getAllUsers()
    setAllUsers(updatedUsers)
  }

  // Handle registration error
  const handleRegistrationError = () => {
    toast({
      title: "Hata",
      description: "Kayıt yapılırken bir hata oluştu.",
      variant: "destructive",
    })
  }

  // Handle status change
  const handleStatusChange = async (status: MatchStatus) => {
    try {
      const success = await updateMatchStatus(matchId, status)

      if (success) {
        setMatch({ ...match, status })
        toast({
          title: "Durum Güncellendi",
          description: `Maç durumu "${status === "registering" ? "Kayıt" : status === "ready" ? "Hazır" : "Tamamlandı"}" olarak güncellendi.`,
        })
      } else {
        toast({
          title: "Hata",
          description: "Durum güncellenirken bir hata oluştu.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating match status:", error)
      toast({
        title: "Hata",
        description: "Durum güncellenirken bir hata oluştu.",
        variant: "destructive",
      })
    }
  }

  // Handle score update
  const handleScoreUpdate = async () => {
    if (scoreA === undefined || scoreB === undefined) {
      toast({
        title: "Hata",
        description: "Lütfen geçerli skor değerleri girin.",
        variant: "destructive",
      })
      return
    }

    try {
      setSavingScore(true)
      const result = await updateMatchScore(matchId, scoreA, scoreB)

      if (result.success) {
        setMatch((prev) => (prev ? { ...prev, score_a: scoreA, score_b: scoreB } : null))
        toast({
          title: "Başarılı",
          description: "Maç skoru güncellendi.",
        })
      } else {
        toast({
          title: "Hata",
          description: result.error || "Skor güncellenirken bir hata oluştu.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating score:", error)
      toast({
        title: "Hata",
        description: "Skor güncellenirken bir hata oluştu.",
        variant: "destructive",
      })
    } finally {
      setSavingScore(false)
    }
  }

  // Open delete dialog
  const openDeleteDialog = (player: PlayerWithDetails) => {
    setPlayerToDelete(player)
    setVerificationPhone("")
    setDeleteDialogOpen(true)
  }

  // Handle delete player
  const handleDeletePlayer = async () => {
    if (!playerToDelete) return

    // If the player doesn't have a phone number or has a generated one, skip verification
    if (
      playerToDelete.phone &&
      !playerToDelete.phone.startsWith("no-phone-") &&
      verificationPhone !== playerToDelete.phone
    ) {
      toast({
        title: "Hata",
        description: "Telefon numarası eşleşmiyor.",
        variant: "destructive",
      })
      return
    }

    try {
      setDeleting(true)
      const success = await removePlayerFromMatch(matchId, playerToDelete.id)

      if (success) {
        // Update players list
        const updatedPlayers = players.filter((p) => p.id !== playerToDelete.id)
        setPlayers(updatedPlayers)

        // Update active player count
        const updatedActiveCount = await getActivePlayerCount(matchId)
        setActivePlayerCount(updatedActiveCount)

        toast({
          title: "Başarılı",
          description: "Oyuncu başarıyla silindi.",
        })

        // Close dialog and reset state
        setDeleteDialogOpen(false)
        setPlayerToDelete(null)
        setVerificationPhone("")
      } else {
        toast({
          title: "Hata",
          description: "Oyuncu silinirken bir hata oluştu.",
        })
      }
    } catch (error) {
      console.error("Error deleting player:", error)
      toast({
        title: "Hata",
        description: "Oyuncu silinirken bir hata oluştu.",
      })
    } finally {
      setDeleting(false)
    }
  }

  // Open cancel registration dialog
  const openCancelDialog = (player: PlayerWithDetails) => {
    if (player.status === "canceled") return // Don't open dialog if already canceled

    setPlayerToCancel(player)
    setCancelDialogOpen(true)
  }

  // Handle cancel registration
  const handleCancelRegistration = async () => {
    if (!playerToCancel) return

    try {
      setCanceling(true)
      const success = await cancelPlayerRegistration(playerToCancel.match_player_id)

      if (success) {
        // Refresh players list
        const updatedPlayers = await getPlayersForMatch(matchId)
        setPlayers(updatedPlayers)

        // Update active player count
        const updatedActiveCount = await getActivePlayerCount(matchId)
        setActivePlayerCount(updatedActiveCount)

        toast({
          title: "Başarılı",
          description: "Kaydınız iptal edildi.",
        })

        // Close dialog and reset state
        setCancelDialogOpen(false)
        setPlayerToCancel(null)
      } else {
        toast({
          title: "Hata",
          description: "Kayıt iptal edilirken bir hata oluştu.",
        })
      }
    } catch (error) {
      console.error("Error canceling registration:", error)
      toast({
        title: "Hata",
        description: "Kayıt iptal edilirken bir hata oluştu.",
        variant: "destructive",
      })
    } finally {
      setCanceling(false)
    }
  }

  // Handle Stripe checkout
  const handleStripeCheckout = async () => {
    if (!playerToPay) return

    try {
      setProcessingPayment(true)
      setStripeError(null)

      // Check if Stripe is properly initialized
      const stripe = await getStripe()
      if (!stripe) {
        setStripeError("Ödeme sistemi başlatılamadı. Lütfen daha sonra tekrar deneyin.")
        setProcessingPayment(false)
        return
      }

      const { sessionId, url } = await createCheckoutSession(matchId, playerToPay.id, playerToPay.match_player_id)

      if (url) {
        window.location.href = url
      } else if (sessionId) {
        const { error } = await stripe.redirectToCheckout({ sessionId })
        if (error) {
          setStripeError(error.message || "Ödeme sayfasına yönlendirme başarısız oldu.")
        }
      } else {
        setStripeError("Ödeme oturumu oluşturulamadı.")
      }
    } catch (error) {
      console.error("Error initiating payment:", error)
      setStripeError("Ödeme başlatılırken bir hata oluştu.")
      toast({
        title: "Hata",
        description: "Ödeme başlatılırken bir hata oluştu.",
        variant: "destructive",
      })
    } finally {
      setProcessingPayment(false)
    }
  }

  // Handle manual payment confirmation (Revolut)
  const handleManualPaymentConfirmation = async () => {
    if (!playerToPay) return

    try {
      setConfirmingManualPayment(true)
      const { success } = await confirmManualPayment(playerToPay.match_player_id)

      if (success) {
        // Update players list with the updated payment status
        const updatedPlayers = await getPlayersForMatch(matchId)
        setPlayers(updatedPlayers)

        toast({
          title: "Başarılı",
          description: "Ödeme durumunuz güncellendi.",
        })

        // Close dialog and reset state
        setPaymentDialogOpen(false)
        setPlayerToPay(null)
        setPaidWithRevolut(false)
      } else {
        toast({
          title: "Hata",
          description: "Ödeme durumu güncellenirken bir hata oluştu.",
        })
      }
    } catch (error) {
      console.error("Error confirming manual payment:", error)
      toast({
        title: "Hata",
        description: "Ödeme durumu güncellenirken bir hata oluştu.",
        variant: "destructive",
      })
    } finally {
      setConfirmingManualPayment(false)
    }
  }

  // Open payment dialog
  const openPaymentDialog = (player: PlayerWithDetails) => {
    setPlayerToPay(player)
    setStripeError(null)
    setPaymentMethod("revolut")
    setPaidWithRevolut(false)
    setPaymentDialogOpen(true)
  }

  // Add the function to handle user confirmation
  const handleConfirmUser = async () => {
    if (!userToConfirm) return

    try {
      setConfirming(true)
      const success = await confirmUser(userToConfirm.id)

      if (success) {
        // Update players list
        const updatedPlayers = players.map((p) => {
          if (p.id === userToConfirm.id) {
            return { ...p, confirmed: true }
          }
          return p
        })
        setPlayers(updatedPlayers)

        toast({
          title: "Başarılı",
          description: "Kullanıcı onaylandı.",
        })

        // Close dialog and reset state
        setConfirmDialogOpen(false)
        setUserToConfirm(null)
      } else {
        toast({
          title: "Hata",
          description: "Kullanıcı onaylanırken bir hata oluştu.",
        })
      }
    } catch (error) {
      console.error("Error confirming user:", error)
      toast({
        title: "Hata",
        description: "Kullanıcı onaylanırken bir hata oluştu.",
        variant: "destructive",
      })
    } finally {
      setConfirming(false)
    }
  }

  // Add the function to open the confirmation dialog
  const openConfirmDialog = (player: PlayerWithDetails) => {
    if (player.confirmed) return // Don't open dialog if already confirmed

    setUserToConfirm(player)
    setConfirmDialogOpen(true)
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return format(date, "dd.MM.yyyy HH:mm", { locale: tr })
    } catch (error) {
      return dateString
    }
  }

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return formatDistanceToNow(date, { addSuffix: true, locale: tr })
    } catch (error) {
      return dateString
    }
  }

  // Get status badge for player
  const getStatusBadge = (player: PlayerWithDetails) => {
    if (player.status === "waitlist") {
      return (
        <Badge variant="outline" className="ml-2 text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
          <Info className="mr-1 h-3 w-3" /> Bekleme Listesi #{player.waitlist_position}
        </Badge>
      )
    } else if (player.status === "canceled") {
      return (
        <Badge variant="outline" className="ml-2 text-xs bg-red-50 text-red-700 border-red-200">
          <XCircle className="mr-1 h-3 w-3" /> İptal Edildi
        </Badge>
      )
    } else if (!player.confirmed) {
      return (
        <Badge variant="outline" className="ml-2 text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
          <Info className="mr-1 h-3 w-3" /> Onaylanmamış
        </Badge>
      )
    }
    return null
  }

  // Check if a phone number is auto-generated
  const isAutoGeneratedPhone = (phone: string) => {
    return phone && phone.startsWith("no-phone-")
  }

  // Format phone number for display
  const formatPhoneForDisplay = (phone: string) => {
    if (isAutoGeneratedPhone(phone)) {
      return "Telefon yok"
    }
    return phone
  }

  // Generate dynamic Revolut payment link with player name and match price
  const getRevolutPaymentLink = () => {
    if (!playerToPay || !match) return ""

    // Format the price without decimal point for the URL (e.g., 7.50 -> 7.50)
    const priceFormatted = match.price.toFixed(2)

    // Encode the player name for the URL - ensure lowercase and proper encoding
    const encodedName = encodeURIComponent(playerToPay.name.toLowerCase())

    return `https://revolut.me/kayacanv/gbp${priceFormatted}/${encodedName}%20pitch%20fee`
  }

  // Handle direct payment with Revolut
  const handleRevolutPayment = async () => {
    if (!playerToPay) return

    try {
      setProcessingPayment(true)

      // Open Revolut payment link in a new tab
      window.open(getRevolutPaymentLink(), "_blank")

      // Removed automatic payment status update here.
      // The user will need to manually confirm payment via the checkbox.

      toast({
        title: "Revolut Ödeme",
        description:
          "Revolut ödeme sayfası açıldı. Ödemeyi tamamladıktan sonra 'Zaten ödeme yaptım' kutucuğunu işaretleyin.",
      })
    } catch (error) {
      console.error("Error processing Revolut payment:", error)
      toast({
        title: "Hata",
        description: "Ödeme işlenirken bir hata oluştu.",
        variant: "destructive",
      })
    } finally {
      setProcessingPayment(false)
    }
  }

  // Handle bulk add
  const handleBulkAdd = async () => {
    if (!bulkAddText.trim()) {
      toast({
        title: "Hata",
        description: "Lütfen eklenecek oyuncuların listesini girin.",
        variant: "destructive",
      })
      return
    }

    setBulkAdding(true)
    setBulkAddResult(null) // Clear previous results

    try {
      const lines = bulkAddText.split("\n").filter((line) => line.trim() !== "")

      const parsedNames = lines
        .map((line) => {
          const name = line
            .replace(/\d+\s*-\s*/, "") // Remove "1 - "
            .replace(/$$.*?$$/g, "") // Remove "(...)"
            .trim()
          // Capitalize first letter, lowercase the rest
          if (!name) return ""
          return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
        })
        .filter(Boolean) as string[]

      const uniqueNames = [...new Set(parsedNames)] // Remove duplicates from input

      const notFoundNames: string[] = []
      const alreadyRegisteredNames: string[] = []
      const usersToRegister: UserType[] = []

      // Create a lowercase map for efficient lookup
      const existingPlayersLower = new Set(
        players.filter((p) => p.status !== "canceled").map((p) => p.name.toLowerCase()),
      )
      const allUsersLowerMap = new Map(allUsers.map((u) => [u.name.toLowerCase(), u]))

      for (const name of uniqueNames) {
        if (!name) continue

        // Check if already registered
        if (existingPlayersLower.has(name.toLowerCase())) {
          alreadyRegisteredNames.push(name)
          continue
        }

        // Find user in DB
        const user = allUsersLowerMap.get(name.toLowerCase())
        if (user) {
          usersToRegister.push(user)
        } else {
          notFoundNames.push(name)
        }
      }

      // Register the found users
      if (usersToRegister.length > 0) {
        const registrationPromises = usersToRegister.map((user) =>
          registerPlayerForMatch(matchId, user.name, user.phone, user.position || ""),
        )
        await Promise.all(registrationPromises)
      }

      // Set results for display
      setBulkAddResult({
        added: usersToRegister,
        alreadyRegistered: alreadyRegisteredNames,
        notFound: notFoundNames,
      })

      toast({
        title: "Toplu Ekleme Tamamlandı",
        description: "Sonuçlar aşağıda gösterilmiştir.",
      })

      // Refresh data
      const updatedPlayers = await getPlayersForMatch(matchId)
      setPlayers(updatedPlayers)
      const updatedActiveCount = await getActivePlayerCount(matchId)
      setActivePlayerCount(updatedActiveCount)

      // Close dialog
      setBulkAddDialogOpen(false)
      setBulkAddText("")
    } catch (error) {
      console.error("Error during bulk add:", error)
      toast({
        title: "Hata",
        description: "Toplu ekleme sırasında bir hata oluştu.",
        variant: "destructive",
      })
    } finally {
      setBulkAdding(false)
    }
  }

  // Group players by status and team
  const teamAPlayers = players.filter((p) => p.status === "active" && p.team === "A")
  const teamBPlayers = players.filter((p) => p.status === "active" && p.team === "B")
  const unassignedPlayers = players.filter((p) => p.status === "active" && !p.team)
  const waitlistedPlayers = players.filter((p) => p.status === "waitlist")
  const canceledPlayers = players.filter((p) => p.status === "canceled")

  const showTeamView = match && (match.status === "ready" || match.status === "done")

  if (loading) {
    return (
      <div className="container max-w-md mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p>Yükleniyor...</p>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="container max-w-md mx-auto px-4 py-8 text-center">
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

  // Calculate Stripe price (base price + 0.20)
  const stripePrice = match.price + 0.2

  const renderPlayerList = (
    playerList: PlayerWithDetails[],
    title: string,
    listType: "active" | "waitlist" | "canceled" | "team",
  ) => {
    if (playerList.length === 0) return null

    return (
      <div className="mb-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>
        <div className="space-y-2">
          {playerList.map((player) => (
            <div
              key={player.id}
              className={`flex justify-between items-center p-3 border rounded-lg ${
                match.status === "done" && listType === "team"
                  ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  : ""
              } ${listType === "waitlist" ? "bg-yellow-50 dark:bg-yellow-900/20" : ""} ${listType === "canceled" ? "bg-gray-50 dark:bg-gray-800/30 opacity-75" : ""}`}
              onClick={() => (match.status === "done" && listType === "team" ? openPaymentDialog(player) : null)}
            >
              <div>
                <div className="font-medium flex items-center">
                  <Link
                    href={`/profile/${player.id}`}
                    className="hover:text-blue-600 hover:underline transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {player.name}
                  </Link>
                  {getStatusBadge(player)}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center">
                  {listType === "canceled" ? (
                    <>
                      <XCircle className="h-3 w-3 mr-1" />
                      İptal: {formatDate(player.cancellation_date || "")}
                    </>
                  ) : (
                    <>
                      <Clock3 className="h-3 w-3 mr-1" />
                      {formatRelativeTime(player.registration_date)}
                    </>
                  )}
                </div>
                {player.position && (
                  <Badge
                    variant="outline"
                    className={`mt-1 ${listType === "waitlist" || listType === "canceled" ? "bg-white" : ""}`}
                  >
                    {player.position.charAt(0).toUpperCase() + player.position.slice(1)}
                  </Badge>
                )}
              </div>

              <div className="flex items-center">
                {match.status === "done" && listType === "team" ? (
                  player.has_paid ? (
                    <Badge className="bg-green-500">
                      <Check className="mr-1 h-3 w-3" /> Ödedi
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <X className="mr-1 h-3 w-3" /> Ödemedi
                    </Badge>
                  )
                ) : (
                  match.status === "registering" &&
                  (listType === "active" || listType === "waitlist") && (
                    <div className="flex">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-yellow-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          openCancelDialog(player)
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            openDeleteDialog(player)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )
                )}

                {isAdmin &&
                  !player.confirmed &&
                  (listType === "active" || listType === "waitlist" || listType === "team") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        openConfirmDialog(player)
                      }}
                    >
                      <Check className="mr-1 h-3 w-3" /> Onayla
                    </Button>
                  )}
                {isAdmin && listType === "canceled" && (
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        openDeleteDialog(player)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-md mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <Link href="/" passHref>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Geri
          </Button>
        </Link>

        {/* Admin Status Dropdown - Only visible when ?admin=true */}
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <span className="mr-2">
                  {match.status === "registering" ? "Kayıt" : match.status === "ready" ? "Hazır" : "Tamamlandı"}
                </span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleStatusChange("registering")}>Kayıt Aşaması</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange("ready")}>Hazır</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange("done")}>Tamamlandı</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <h1 className="text-2xl font-bold mb-4">{match ? formatReadableDate(match.date) : "Perşembe Halısaha"}</h1>

      {/* Match Info Card */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle>{formatReadableDate(match.date)} - Maç Bilgileri</CardTitle>
          <CardDescription>
            {match.status === "registering"
              ? "Kayıt aşamasında"
              : match.status === "ready"
                ? "Takımlar hazırlanıyor"
                : "Maç tamamlandı"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center mb-2">
            <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>{match.time}</span>
          </div>
          <div className="flex items-center">
            <Users className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>
              Kayıtlı Oyuncu: {activePlayerCount}/16
              {waitlistedPlayers.length > 0 && ` (Bekleme Listesi: ${waitlistedPlayers.length})`}
              {canceledPlayers.length > 0 && ` (İptal: ${canceledPlayers.length})`}
            </span>
          </div>

          {/* Score Section */}
          <div className="mt-4 pt-4 border-t">
            {isAdmin && match.status === "done" ? (
              <div>
                <h3 className="text-sm font-medium mb-2">Skor</h3>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1">
                    <Label htmlFor="scoreA" className="text-xs mb-1 block">
                      Takım A
                    </Label>
                    <Input
                      id="scoreA"
                      type="number"
                      min="0"
                      value={scoreA ?? 0}
                      onChange={(e) => setScoreA(Number.parseInt(e.target.value) || 0)}
                      className="text-center"
                    />
                  </div>
                  <div className="text-xl font-bold self-end mb-2">-</div>
                  <div className="flex-1">
                    <Label htmlFor="scoreB" className="text-xs mb-1 block">
                      Takım B
                    </Label>
                    <Input
                      id="scoreB"
                      type="number"
                      min="0"
                      value={scoreB ?? 0}
                      onChange={(e) => setScoreB(Number.parseInt(e.target.value) || 0)}
                      className="text-center"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleScoreUpdate}
                  disabled={savingScore}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {savingScore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Kaydediliyor...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" /> Skoru Kaydet
                    </>
                  )}
                </Button>
              </div>
            ) : (
              match.status === "done" && (
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">Skor</div>
                  <div className="text-2xl font-bold">
                    {match.score_a ?? 0} - {match.score_b ?? 0}
                  </div>
                </div>
              )
            )}
          </div>

          <div className="mt-4 pt-4 border-t grid grid-cols-1 gap-2">
            <Link href={`/organize_teams/${match.id}`} passHref>
              <Button variant="outline" className="w-full bg-transparent">
                <Users className="mr-2 h-4 w-4" />
                Takımları Düzenle
              </Button>
            </Link>
            {isAdmin && (
              <Button variant="outline" className="w-full bg-transparent" onClick={() => setBulkAddDialogOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Toplu Oyuncu Ekle
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Add Result Card */}
      {bulkAddResult && (
        <Card className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Toplu Ekleme Sonucu</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setBulkAddResult(null)}>
              <X className="h-4 w-4" />
              <span className="sr-only">Sonucu gizle</span>
            </Button>
          </CardHeader>
          <CardContent>
            {bulkAddResult.added.length > 0 && (
              <div className="mb-3">
                <p className="font-medium text-green-700 dark:text-green-400">
                  {bulkAddResult.added.length} oyuncu eklendi:
                </p>
                <p className="text-sm text-muted-foreground">{bulkAddResult.added.map((u) => u.name).join(", ")}</p>
              </div>
            )}
            {bulkAddResult.alreadyRegistered.length > 0 && (
              <div className="mb-3">
                <p className="font-medium text-yellow-700 dark:text-yellow-400">
                  {bulkAddResult.alreadyRegistered.length} oyuncu zaten kayıtlıydı:
                </p>
                <p className="text-sm text-muted-foreground">{bulkAddResult.alreadyRegistered.join(", ")}</p>
              </div>
            )}
            {bulkAddResult.notFound.length > 0 && (
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">
                  {bulkAddResult.notFound.length} oyuncu sistemde bulunamadı:
                </p>
                <p className="text-sm text-muted-foreground mb-2">
                  Bu oyuncuları manuel olarak kaydetmek için isimlerine tıklayın.
                </p>
                <div className="flex flex-wrap gap-2">
                  {bulkAddResult.notFound.map((notFoundName) => (
                    <Button
                      key={notFoundName}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setName(notFoundName)
                        const nameInput = document.getElementById("name-input")
                        if (nameInput) {
                          nameInput.focus()
                          nameInput.scrollIntoView({ behavior: "smooth", block: "center" })
                        }
                      }}
                    >
                      {notFoundName}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Registration Form - Only show when status is registering */}
      {match.status === "registering" && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Kayıt Ol</CardTitle>
            <CardDescription>Maça katılmak için kaydol</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name-input">
                  İsim <span className="text-red-500">*</span>
                </Label>
                <PlayerNameAutocomplete
                  id="name-input"
                  users={allUsers}
                  value={name}
                  onChange={setName}
                  onSelectUser={handleUserSelect}
                  disabled={submitting}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={handleRegister} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Kaydediliyor...
                    </>
                  ) : (
                    "Kaydol"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Players List */}
      <Card>
        <CardHeader>
          <CardTitle>{match.status === "done" ? "Ödeme Durumu" : "Kayıtlı Oyuncular"}</CardTitle>
          <CardDescription>
            {match.status === "done" ? "Oyuncuların ödeme durumu" : `Toplam ${activePlayerCount} aktif oyuncu kayıtlı`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showTeamView ? (
            <>
              {renderPlayerList(teamAPlayers, "Takım A", "team")}
              {renderPlayerList(teamBPlayers, "Takım B", "team")}
              {renderPlayerList(unassignedPlayers, "Takım Belirsiz", "team")}
            </>
          ) : (
            renderPlayerList(
              players.filter((p) => p.status === "active"),
              "Aktif Oyuncular",
              "active",
            )
          )}
          {renderPlayerList(waitlistedPlayers, "Bekleme Listesi", "waitlist")}
          {renderPlayerList(canceledPlayers, "İptal Edilenler", "canceled")}

          {players.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">Henüz kayıtlı oyuncu bulunmamaktadır.</div>
          )}
        </CardContent>
      </Card>

      {/* Delete Player Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Oyuncu Silme</DialogTitle>
            <DialogDescription>
              {playerToDelete?.name} isimli oyuncuyu silmek istediğinize emin misiniz?
              {playerToDelete?.phone && !isAutoGeneratedPhone(playerToDelete.phone)
                ? " Telefon numarasını girerek onaylayın."
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {playerToDelete?.phone && !isAutoGeneratedPhone(playerToDelete.phone) ? (
              <div className="space-y-2">
                <Label htmlFor="verification-phone">Telefon Numarası</Label>
                <Input
                  id="verification-phone"
                  placeholder="5XX XXX XX XX"
                  value={verificationPhone}
                  onChange={(e) => setVerificationPhone(e.target.value)}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isAutoGeneratedPhone(playerToDelete?.phone || "")
                  ? "Bu oyuncu telefon numarası olmadan kaydedilmiş."
                  : "Bu oyuncu için telefon doğrulaması gerekmemektedir."}{" "}
                Silmek için onaylayın.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDeletePlayer} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Siliniyor...
                </>
              ) : (
                "Sil"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Registration Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kayıt İptali</DialogTitle>
            <DialogDescription>
              {playerToCancel?.name} isimli oyuncu için kaydınızı iptal etmek istediğinize emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              İptal edilen kayıtlar listede görünmeye devam edecek ancak aktif oyuncular arasında yer almayacaktır.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={canceling}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={handleCancelRegistration} disabled={canceling}>
              {canceling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> İptal Ediliyor...
                </>
              ) : (
                "İptal Et"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ödeme Yap</DialogTitle>
            <DialogDescription>
              Maç ücreti £{match?.price.toFixed(2)} ödemenizi güvenli bir şekilde yapabilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Tabs value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as "stripe" | "revolut")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="revolut">
                  <ExternalLink className="mr-2 h-4 w-4" /> Revolut
                </TabsTrigger>
                <TabsTrigger value="stripe">
                  <CreditCard className="mr-2 h-4 w-4" /> Kredi Kartı
                </TabsTrigger>
              </TabsList>

              {/* Revolut Payment Tab */}
              <TabsContent value="revolut" className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border dark:border-gray-800">
                  <div className="text-center mb-4">
                    <p className="font-medium mb-2">Revolut ile ödeme</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Aşağıdaki butona tıklayarak Revolut üzerinden ödeme yapabilirsiniz.
                    </p>
                    <p className="text-lg font-bold text-green-600 mb-4">£{match?.price.toFixed(2)}</p>
                    <Button
                      onClick={handleRevolutPayment}
                      disabled={processingPayment}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {processingPayment ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> İşleniyor...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="mr-2 h-4 w-4" /> Revolut ile Öde
                        </>
                      )}
                    </Button>
                    <a
                      href="https://revolut.me/kayacanv"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 text-sm text-center text-blue-600 hover:underline dark:text-blue-400 block"
                    >
                      Alternatif Link
                    </a>
                  </div>

                  <div className="flex items-center space-x-2 mt-4 p-2 rounded-md bg-background border">
                    <Checkbox
                      id="paid-with-revolut"
                      checked={paidWithRevolut}
                      onCheckedChange={(checked) => setPaidWithRevolut(checked as boolean)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    />
                    <label
                      htmlFor="paid-with-revolut"
                      className="text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Zaten ödeme yaptım
                    </label>
                  </div>
                </div>
              </TabsContent>

              {/* Stripe Payment Tab */}
              <TabsContent value="stripe" className="space-y-4">
                {stripeError ? (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center border border-red-200 dark:border-red-800">
                    <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400 mx-auto mb-2" />
                    <p className="text-red-700 dark:text-red-400 font-medium">{stripeError}</p>
                    <p className="text-sm text-red-600 dark:text-red-300 mt-2">
                      Lütfen daha sonra tekrar deneyin veya yönetici ile iletişime geçin.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border dark:border-gray-800 text-center">
                    <p className="font-medium mb-2">Stripe ile güvenli ödeme</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Kredi kartı veya banka kartı ile ödeme yapabilirsiniz.
                    </p>
                    <div className="mb-4">
                      <p className="text-lg font-bold text-blue-600">£{stripePrice.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        (£{match?.price.toFixed(2)} + £0.20 Stripe komisyonu)
                      </p>
                    </div>
                    <Button onClick={handleStripeCheckout} disabled={processingPayment} className="w-full">
                      {processingPayment ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> İşleniyor...
                        </>
                      ) : (
                        <>£{stripePrice.toFixed(2)} Öde</>
                      )}
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPaymentDialogOpen(false)}
              disabled={processingPayment || confirmingManualPayment}
            >
              İptal
            </Button>
            {paymentMethod === "revolut" && (
              <Button
                onClick={handleManualPaymentConfirmation}
                disabled={!paidWithRevolut || confirmingManualPayment}
                className="bg-green-600 hover:bg-green-700"
              >
                {confirmingManualPayment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> İşleniyor...
                  </>
                ) : (
                  "Tamam"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm User Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kullanıcı Onaylama</DialogTitle>
            <DialogDescription>
              {userToConfirm?.name} isimli kullanıcıyı onaylamak istediğinize emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)} disabled={confirming}>
              İptal
            </Button>
            <Button onClick={handleConfirmUser} disabled={confirming} className="bg-green-600 hover:bg-green-700">
              {confirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Onaylanıyor...
                </>
              ) : (
                "Onayla"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkAddDialogOpen} onOpenChange={setBulkAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Toplu Oyuncu Ekle</DialogTitle>
            <DialogDescription>
              Oyuncu listesini aşağıya yapıştırın. Her oyuncu yeni bir satırda olmalıdır. Sistemde kayıtlı olmayan veya
              zaten maçta olan oyuncular eklenmeyecektir.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder={`1 - Arda
2 - Hakan
3 - Soner (Safa +1)`}
              value={bulkAddText}
              onChange={(e) => setBulkAddText(e.target.value)}
              className="min-h-[200px]"
              disabled={bulkAdding}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAddDialogOpen(false)} disabled={bulkAdding}>
              İptal
            </Button>
            <Button onClick={handleBulkAdd} disabled={bulkAdding}>
              {bulkAdding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ekleniyor...
                </>
              ) : (
                "Oyuncuları Ekle"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  )
}
