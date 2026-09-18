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
  Loader2,
  Info,
  AlertTriangle,
  XCircle,
  Clock3,
  ExternalLink,
  CreditCard,
  Save,
  UserPlus,
  Pencil,
  Calendar,
  Landmark,
  Copy,
  PoundSterling,
  Lock,
  LogIn,
  Phone,
  Sparkles,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import type { Match, MatchStatus, PlayerWithDetails } from "@/app/lib/types"
import {
  getMatchById,
  getPlayersForMatch,
  updateMatchStatus,
  registerPlayerForMatch,
  removePlayerFromMatch,
  confirmUser,
  getAllUsers,
  getActivePlayerCount,
} from "@/app/lib/data-service"
import Link from "next/link"
import { createCheckoutSession, verifyPaymentStatus, confirmManualPayment } from "@/app/actions/stripe-actions"
import { getPayerInfo, type PayerInfo } from "@/app/actions/starling-actions"
import { updateMatchScore, updateMatchDate, updateMatchTime, updateMatchPrice } from "@/app/actions/match-actions"
import { getStripe } from "@/app/lib/stripe"
import { paymentRef } from "@/app/lib/payment-ref"
import { MAX_ACTIVE_PLAYERS } from "@/app/lib/constants"
import { isPlaceholderPhone, samePhone } from "@/app/lib/phone"
import type { User as UserType } from "@/app/lib/types"
import { formatDistanceToNow } from "date-fns"
import { enUS, tr as trLocale } from "date-fns/locale"
import { PlayerNameAutocomplete } from "@/app/components/player-name-autocomplete"
import { Textarea } from "@/components/ui/textarea"
import MvpVoting from "@/app/components/mvp-voting"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { formatMatchDate, formatFullDate } from "@/lib/i18n/format"

// Revolut (manual "mark as paid") is disabled for matches on/after 4 June 2026 —
// from then on only Starling and Stripe are accepted. Older matches keep Revolut.
const REVOLUT_CUTOFF = new Date(2026, 5, 4) // month is 0-indexed: 5 = June
function isRevolutAllowed(match: { date: string } | null): boolean {
  if (!match) return false
  const [dd, mm, yyyy] = match.date.split(".").map(Number)
  if (!dd || !mm || !yyyy) return true
  return new Date(yyyy, mm - 1, dd) < REVOLUT_CUTOFF
}

export default function MatchPage({ params }: { params: { id: string } }) {
  const { t, locale } = useTranslation()
  const dateFnsLocale = locale === "en" ? enUS : trLocale
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

  // Score state
  const [scoreA, setScoreA] = useState<number | undefined>(undefined)
  const [scoreB, setScoreB] = useState<number | undefined>(undefined)
  const [savingScore, setSavingScore] = useState(false)

  // Date edit state
  const [isEditingDate, setIsEditingDate] = useState(false)
  const [editedDate, setEditedDate] = useState<Date | undefined>(undefined)
  const [savingDate, setSavingDate] = useState(false)

  // Time edit state
  const [isEditingTime, setIsEditingTime] = useState(false)
  const [editedTime, setEditedTime] = useState("")
  const [savingTime, setSavingTime] = useState(false)

  // Price edit state
  const [isEditingPrice, setIsEditingPrice] = useState(false)
  const [editedPrice, setEditedPrice] = useState("")
  const [savingPrice, setSavingPrice] = useState(false)

  // Registration state
  const [name, setName] = useState("")
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Remove-from-list dialog state
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [playerToRemove, setPlayerToRemove] = useState<PlayerWithDetails | null>(null)
  const [verificationPhone, setVerificationPhone] = useState("")
  const [removing, setRemoving] = useState(false)

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [playerToPay, setPlayerToPay] = useState<PlayerWithDetails | null>(null)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "revolut" | "starling" | "starling-auto">("revolut")
  const [checkingStarling, setCheckingStarling] = useState(false)
  // What the Starling tabs may say about the player being paid for: has paid
  // before, has a phone on file, and the recognised bank name (only when the
  // viewer is allowed to see it — decided server-side).
  const [payerInfo, setPayerInfo] = useState<PayerInfo | null>(null)
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
            title: t("common.error"),
            description: t("error.matchNotFoundDesc"),
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
          title: t("common.error"),
          description: t("profile.dataLoadError"),
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
            title: t("common.success"),
            description: t("payment.received"),
          })

          // Refresh players list
          const updatedPlayers = await getPlayersForMatch(matchId)
          setPlayers(updatedPlayers)
        }
      } else if (paymentCanceled === "true") {
        toast({
          title: t("common.cancel"),
          description: t("payment.paymentCanceled"),
        })
      }
    }

    checkPaymentStatus()
  }, [paymentSuccess, paymentCanceled, sessionId, matchId])

  // Check if a user is already registered for this match
  const isUserRegistered = (userName: string) => {
    return players.some((player) => player.name.toLowerCase() === userName.toLowerCase())
  }

  // Handle user selection from autocomplete
  const handleUserSelect = (user: UserType) => {
    setSelectedUser(user)
  }

  // Handle registration
  const handleRegister = async () => {
    if (!name) {
      toast({
        title: t("common.error"),
        description: t("match.nameRequired"),
        variant: "destructive",
      })
      return
    }

    // Check if the user is already registered for this match
    if (isUserRegistered(name)) {
      toast({
        title: t("common.info"),
        description: t("match.alreadyRegistered", { name }),
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

    const isWaitlisted = updatedActiveCount > MAX_ACTIVE_PLAYERS

    toast({
      title: t("common.success"),
      description: isWaitlisted ? t("match.addedToWaitlist") : t("match.registeredSuccess"),
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
      title: t("common.error"),
      description: t("match.registrationError"),
      variant: "destructive",
    })
  }

  // Handle status change
  const handleStatusChange = async (status: MatchStatus) => {
    try {
      const success = await updateMatchStatus(matchId, status)

      if (success) {
        setMatch({ ...match, status })
        const statusLabel =
          status === "registering" ? t("match.statusRegisteringShort") : t("match.statusDoneShort")
        toast({
          title: t("match.statusUpdatedTitle"),
          description: t("match.statusUpdated", { status: statusLabel }),
        })
      } else {
        toast({
          title: t("common.error"),
          description: t("match.statusUpdateError"),
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating match status:", error)
      toast({
        title: t("common.error"),
        description: t("match.statusUpdateError"),
        variant: "destructive",
      })
    }
  }

  // Handle date update
  const handleDateUpdate = async () => {
    if (!editedDate) {
      toast({
        title: t("common.error"),
        description: t("match.invalidDate"),
        variant: "destructive",
      })
      return
    }

    try {
      setSavingDate(true)
      // Convert Date to DD.MM.YYYY format
      const day = String(editedDate.getDate()).padStart(2, "0")
      const month = String(editedDate.getMonth() + 1).padStart(2, "0")
      const year = editedDate.getFullYear()
      const formattedDate = `${day}.${month}.${year}`

      const result = await updateMatchDate(matchId, formattedDate)

      if (result.success) {
        setMatch((prev) => (prev ? { ...prev, date: formattedDate } : null))
        setIsEditingDate(false)
        toast({
          title: t("common.success"),
          description: t("match.dateUpdated"),
        })
      } else {
        toast({
          title: t("common.error"),
          description: result.error || t("match.dateUpdateError"),
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating date:", error)
      toast({
        title: t("common.error"),
        description: t("match.dateUpdateError"),
        variant: "destructive",
      })
    } finally {
      setSavingDate(false)
    }
  }

  // Handle time update
  const handleTimeUpdate = async () => {
    const time = editedTime.trim()
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      toast({
        title: t("common.error"),
        description: t("match.invalidTime"),
        variant: "destructive",
      })
      return
    }

    try {
      setSavingTime(true)
      const result = await updateMatchTime(matchId, time)

      if (result.success) {
        setMatch((prev) => (prev ? { ...prev, time } : null))
        setIsEditingTime(false)
        toast({
          title: t("common.success"),
          description: t("match.timeUpdated"),
        })
      } else {
        toast({
          title: t("common.error"),
          description: result.error || t("match.timeUpdateError"),
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating time:", error)
      toast({
        title: t("common.error"),
        description: t("match.timeUpdateError"),
        variant: "destructive",
      })
    } finally {
      setSavingTime(false)
    }
  }

  // Handle price update
  const handlePriceUpdate = async () => {
    const price = Number.parseFloat(editedPrice.replace(",", "."))
    if (!Number.isFinite(price) || price < 0) {
      toast({
        title: t("common.error"),
        description: t("match.invalidPrice"),
        variant: "destructive",
      })
      return
    }

    try {
      setSavingPrice(true)
      const result = await updateMatchPrice(matchId, price)

      if (result.success) {
        const saved = result.price ?? price
        setMatch((prev) => (prev ? { ...prev, price: saved } : null))
        setIsEditingPrice(false)
        toast({
          title: t("common.success"),
          description: t("match.priceUpdated"),
        })
      } else {
        toast({
          title: t("common.error"),
          description: result.error || t("match.priceUpdateError"),
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating price:", error)
      toast({
        title: t("common.error"),
        description: t("match.priceUpdateError"),
        variant: "destructive",
      })
    } finally {
      setSavingPrice(false)
    }
  }

  // Handle score update
  const handleScoreUpdate = async () => {
    if (scoreA === undefined || scoreB === undefined) {
      toast({
        title: t("common.error"),
        description: t("match.invalidScore"),
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
          title: t("common.success"),
          description: t("match.scoreUpdated"),
        })
      } else {
        toast({
          title: t("common.error"),
          description: result.error || t("match.scoreUpdateError"),
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating score:", error)
      toast({
        title: t("common.error"),
        description: t("match.scoreUpdateError"),
        variant: "destructive",
      })
    } finally {
      setSavingScore(false)
    }
  }

  // Open the remove-from-list dialog
  const openRemoveDialog = (player: PlayerWithDetails) => {
    setPlayerToRemove(player)
    setVerificationPhone("")
    setRemoveDialogOpen(true)
  }

  // Handle removing a player from the list. Leaving is a hard delete; a paid
  // player is refused until the payment is un-marked.
  const handleRemovePlayer = async () => {
    if (!playerToRemove) return

    // If the player doesn't have a phone number or has a generated one, skip verification.
    // Otherwise compare loosely (samePhone) so a member can type their number with or
    // without the country code / formatting and still match the E.164-stored value.
    if (!isPlaceholderPhone(playerToRemove.phone) && !samePhone(verificationPhone, playerToRemove.phone)) {
      toast({
        title: t("common.error"),
        description: t("error.phoneMismatch"),
        variant: "destructive",
      })
      return
    }

    try {
      setRemoving(true)
      const result = await removePlayerFromMatch(playerToRemove.match_player_id)

      if (result === "removed") {
        // Refresh the list: a reserve may have been promoted into the freed slot
        const updatedPlayers = await getPlayersForMatch(matchId)
        setPlayers(updatedPlayers)

        const updatedActiveCount = await getActivePlayerCount(matchId)
        setActivePlayerCount(updatedActiveCount)

        toast({
          title: t("common.success"),
          description: t("match.playerRemoved"),
        })

        setRemoveDialogOpen(false)
        setPlayerToRemove(null)
        setVerificationPhone("")
      } else if (result === "blocked_paid") {
        toast({
          title: t("common.error"),
          description: t("match.removeBlockedPaid"),
          variant: "destructive",
        })
        setRemoveDialogOpen(false)
        setPlayerToRemove(null)
        setVerificationPhone("")
      } else {
        toast({
          title: t("common.error"),
          description: t("match.removePlayerError"),
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error removing player:", error)
      toast({
        title: t("common.error"),
        description: t("match.removePlayerError"),
        variant: "destructive",
      })
    } finally {
      setRemoving(false)
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
        setStripeError(t("payment.stripeInitError"))
        setProcessingPayment(false)
        return
      }

      const { sessionId, url } = await createCheckoutSession(matchId, playerToPay.id, playerToPay.match_player_id)

      if (url) {
        window.location.href = url
      } else if (sessionId) {
        const { error } = await stripe.redirectToCheckout({ sessionId })
        if (error) {
          setStripeError(error.message || t("payment.stripeRedirectError"))
        }
      } else {
        setStripeError(t("payment.sessionFailed"))
      }
    } catch (error) {
      console.error("Error initiating payment:", error)
      setStripeError(t("payment.initError"))
      toast({
        title: t("common.error"),
        description: t("payment.initError"),
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
          title: t("common.success"),
          description: t("payment.statusUpdated"),
        })

        // Close dialog and reset state
        setPaymentDialogOpen(false)
        setPlayerToPay(null)
        setPaidWithRevolut(false)
      } else {
        toast({
          title: t("common.error"),
          description: t("payment.updateError"),
        })
      }
    } catch (error) {
      console.error("Error confirming manual payment:", error)
      toast({
        title: t("common.error"),
        description: t("payment.updateError"),
        variant: "destructive",
      })
    } finally {
      setConfirmingManualPayment(false)
    }
  }

  // Starling: payment is confirmed automatically by the bank webhook. This just
  // re-checks whether the transfer has landed yet and closes the dialog if paid.
  const handleCheckStarlingPayment = async () => {
    if (!playerToPay) return
    try {
      setCheckingStarling(true)
      const updatedPlayers = await getPlayersForMatch(matchId)
      setPlayers(updatedPlayers)
      const me = updatedPlayers.find((p) => p.match_player_id === playerToPay.match_player_id)
      if (me?.has_paid) {
        toast({ title: t("payment.received"), description: t("payment.confirmed") })
        setPaymentDialogOpen(false)
        setPlayerToPay(null)
      } else {
        toast({
          title: t("payment.pending"),
          description: t("payment.notYetReceived"),
        })
      }
    } catch (error) {
      console.error("Error checking Starling payment:", error)
    } finally {
      setCheckingStarling(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast({ title: t("common.copied"), description: t("common.copySuccess", { label }) }),
      () => {},
    )
  }

  // Open payment dialog
  const openPaymentDialog = (player: PlayerWithDetails) => {
    setPlayerToPay(player)
    setStripeError(null)
    setPaymentMethod(isRevolutAllowed(match) ? "revolut" : "starling")
    setPaidWithRevolut(false)
    setPayerInfo(null)
    setPaymentDialogOpen(true)

    // Known payer with a phone on file lands on the Otomatik tab. The dialog
    // opens at once; the tab switches when the answer arrives, unless the user
    // has already picked another tab.
    getPayerInfo(player.id)
      .then((info) => {
        setPayerInfo(info)
        if (info.known && info.phoneOnFile) {
          setPaymentMethod((current) => (current === "starling" ? "starling-auto" : current))
        }
      })
      .catch((error) => console.error("Error loading payer info:", error))
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
          title: t("common.success"),
          description: t("match.userApproved"),
        })

        // Close dialog and reset state
        setConfirmDialogOpen(false)
        setUserToConfirm(null)
      } else {
        toast({
          title: t("common.error"),
          description: t("match.confirmUserError"),
        })
      }
    } catch (error) {
      console.error("Error confirming user:", error)
      toast({
        title: t("common.error"),
        description: t("match.confirmUserError"),
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

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return formatDistanceToNow(date, { addSuffix: true, locale: dateFnsLocale })
    } catch (error) {
      return dateString
    }
  }

  // Get status badge for player
  const getStatusBadge = (player: PlayerWithDetails) => {
    if (player.status === "waitlist") {
      return (
        <Badge variant="outline" className="ml-2 text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
          <Info className="mr-1 h-3 w-3" /> {t("match.waitlistBadge", { position: player.waitlist_position ?? "" })}
        </Badge>
      )
    } else if (!player.confirmed) {
      return (
        <Badge variant="outline" className="ml-2 text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
          <Info className="mr-1 h-3 w-3" /> {t("match.unconfirmedBadge")}
        </Badge>
      )
    }
    return null
  }

  // Whether a player has a real (non-placeholder) number on file. Used only to decide
  // if delete-verification is required — the number itself is never displayed.
  const isAutoGeneratedPhone = (phone: string) => isPlaceholderPhone(phone)

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
        title: t("payment.revolutPayment"),
        description: t("payment.revolutInstructions"),
      })
    } catch (error) {
      console.error("Error processing Revolut payment:", error)
      toast({
        title: t("common.error"),
        description: t("payment.initError"),
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
        title: t("common.error"),
        description: t("match.bulkAddEmpty"),
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
            .replace(/\s*$$.*$$/, "") // Remove content in parentheses
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
      const existingPlayersLower = new Set(players.map((p) => p.name.toLowerCase()))
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
        title: t("match.bulkAddResultTitle"),
        description: t("match.bulkAddResultsShown"),
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
        title: t("common.error"),
        description: t("match.bulkAddError"),
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

  // The team view is derived from the data: once anyone has a side (or the match
  // is over) the roster is shown as teams. No manual status flip is needed.
  const showTeamView =
    match && (match.status === "done" || players.some((p) => p.team === "A" || p.team === "B"))

  if (loading) {
    return (
      <div className="container max-w-md mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p>{t("common.loading")}</p>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="container max-w-md mx-auto px-4 py-8 text-center">
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

  // Calculate Stripe price (base price + 0.20)
  const stripePrice = match.price + 0.2
  const revolutAllowed = isRevolutAllowed(match)
  // Otomatik (no-reference) Starling tab: only for players we have matched a
  // payment for before AND who have a real phone on file. UI gate only — the
  // matcher's payer fallback runs for everyone.
  const autoTabAvailable = !!payerInfo?.known && !!payerInfo?.phoneOnFile
  const paymentTabCols = ["grid-cols-2", "grid-cols-3", "grid-cols-4"][
    (revolutAllowed ? 1 : 0) + (autoTabAvailable ? 1 : 0)
  ]
  const settleUpUrl = `https://settleup.starlingbank.com/kayacan-vesek-6f4fc7?amount=${match?.price.toFixed(2) ?? ""}`

  const renderPlayerList = (
    playerList: PlayerWithDetails[],
    title: string,
    listType: "active" | "waitlist" | "team",
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
              } ${listType === "waitlist" ? "bg-yellow-50 dark:bg-yellow-900/20" : ""}`}
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
                  <Clock3 className="h-3 w-3 mr-1" />
                  {formatRelativeTime(player.registration_date)}
                </div>
                {player.position && (
                  <Badge
                    variant="outline"
                    className={`mt-1 ${listType === "waitlist" ? "bg-white" : ""}`}
                  >
                    {player.position.charAt(0).toUpperCase() + player.position.slice(1)}
                  </Badge>
                )}
              </div>

              <div className="flex items-center">
                {match.status === "done" && listType === "team" ? (
                  player.has_paid ? (
                    <Badge className="bg-green-500">
                      <Check className="mr-1 h-3 w-3" /> {t("payment.paid")}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <X className="mr-1 h-3 w-3" /> {t("payment.unpaid")}
                    </Badge>
                  )
                ) : (
                  // Dropouts happen right up to kickoff, so the remove control stays on
                  // every list (including the team view) until the match is done.
                  match.status !== "done" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        openRemoveDialog(player)
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
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
                      <Check className="mr-1 h-3 w-3" /> {t("common.approve")}
                    </Button>
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
            {t("common.back")}
          </Button>
        </Link>

        {/* Admin Status Dropdown - Only visible when ?admin=true */}
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <span className="mr-2">
                  {match.status === "registering" ? t("match.statusRegisteringShort") : t("match.statusDoneShort")}
                </span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleStatusChange("registering")}>
                {t("match.statusRegisteringShort")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange("done")}>
                {t("match.statusDoneShort")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Title with editable date for admin */}
      <div className="flex items-center gap-2 mb-4">
        {isAdmin && isEditingDate ? (
          <div className="flex items-center gap-2 flex-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="bg-transparent w-fit text-lg font-bold">
                  <Calendar className="mr-2 h-5 w-5" />
                  {editedDate ? formatFullDate(editedDate, locale) : t("common.selectDate")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent mode="single" selected={editedDate} onSelect={setEditedDate} initialFocus />
              </PopoverContent>
            </Popover>
            <Button
              size="sm"
              onClick={handleDateUpdate}
              disabled={savingDate || !editedDate}
              className="bg-green-600 hover:bg-green-700"
            >
              {savingDate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-transparent"
              onClick={() => setIsEditingDate(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold">{match ? formatMatchDate(match.date, locale) : "Persembe Halisaha"}</h1>
            {isAdmin && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  // Convert DD.MM.YYYY to Date object
                  if (match?.date) {
                    const [day, month, year] = match.date.split(".")
                    const dateObj = new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day))
                    setEditedDate(dateObj)
                  }
                  setIsEditingDate(true)
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </div>

      {/* Match Info Card */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {formatMatchDate(match.date, locale)} - {t("match.infoTitle")}
          </CardTitle>
          <CardDescription>
            {match.status === "registering" ? t("match.statusRegistering") : t("match.statusDone")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Kickoff time — editable for admin */}
          <div className="flex items-center mb-2 min-h-9">
            <Clock className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            {isAdmin && isEditingTime ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={editedTime}
                  onChange={(e) => setEditedTime(e.target.value)}
                  className="h-9 w-[7.5rem]"
                  aria-label={t("match.timeLabel")}
                />
                <Button
                  size="sm"
                  onClick={handleTimeUpdate}
                  disabled={savingTime || !editedTime}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {savingTime ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-transparent"
                  onClick={() => setIsEditingTime(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <span>{match.time}</span>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-1 h-8 w-8 p-0"
                    onClick={() => {
                      setEditedTime(match.time)
                      setIsEditingTime(true)
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Fee per player — editable for admin */}
          <div className="flex items-center mb-2 min-h-9">
            <PoundSterling className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            {isAdmin && isEditingPrice ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  value={editedPrice}
                  onChange={(e) => setEditedPrice(e.target.value)}
                  className="h-9 w-[7.5rem]"
                  aria-label={t("match.priceLabel")}
                />
                <Button
                  size="sm"
                  onClick={handlePriceUpdate}
                  disabled={savingPrice || editedPrice.trim() === ""}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {savingPrice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-transparent"
                  onClick={() => setIsEditingPrice(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <span>
                  £{match.price.toFixed(2)}{" "}
                  <span className="text-muted-foreground">({t("match.priceLabel")})</span>
                </span>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-1 h-8 w-8 p-0"
                    onClick={() => {
                      setEditedPrice(match.price.toFixed(2))
                      setIsEditingPrice(true)
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center">
            <Users className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>
              {t("match.registeredPlayers", { count: activePlayerCount })}
              {waitlistedPlayers.length > 0 && ` ${t("match.waitlistCount", { count: waitlistedPlayers.length })}`}
            </span>
          </div>

          {/* Score Section */}
          <div className="mt-4 pt-4 border-t">
            {isAdmin && match.status === "done" ? (
              <div>
                <h3 className="text-sm font-medium mb-2">{t("match.scoreHeading")}</h3>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1">
                    <Label htmlFor="scoreA" className="text-xs mb-1 block">
                      {t("team.a")}
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
                      {t("team.b")}
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
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.saving")}
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" /> {t("match.saveScore")}
                    </>
                  )}
                </Button>
              </div>
            ) : (
              match.status === "done" && (
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">{t("match.scoreHeading")}</div>
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
                {t("match.organizeTeams")}
              </Button>
            </Link>
            {isAdmin && (
              <Button variant="outline" className="w-full bg-transparent" onClick={() => setBulkAddDialogOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                {t("match.bulkAdd")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* MVP voting (time-windowed: opens after the match, closes next week) */}
      <div className="mb-6">
        <MvpVoting match={{ id: match.id, date: match.date, time: match.time }} />
      </div>

      {/* Bulk Add Result Card */}
      {bulkAddResult && (
        <Card className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">{t("match.bulkAddResultTitle")}</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setBulkAddResult(null)}>
              <X className="h-4 w-4" />
              <span className="sr-only">{t("common.dismiss")}</span>
            </Button>
          </CardHeader>
          <CardContent>
            {bulkAddResult.added.length > 0 && (
              <div className="mb-3">
                <p className="font-medium text-green-700 dark:text-green-400">
                  {t("match.bulkAddedCount", { count: bulkAddResult.added.length })}
                </p>
                <p className="text-sm text-muted-foreground">{bulkAddResult.added.map((u) => u.name).join(", ")}</p>
              </div>
            )}
            {bulkAddResult.alreadyRegistered.length > 0 && (
              <div className="mb-3">
                <p className="font-medium text-yellow-700 dark:text-yellow-400">
                  {t("match.alreadyRegisteredCount", { count: bulkAddResult.alreadyRegistered.length })}
                </p>
                <p className="text-sm text-muted-foreground">{bulkAddResult.alreadyRegistered.join(", ")}</p>
              </div>
            )}
            {bulkAddResult.notFound.length > 0 && (
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">
                  {t("match.notFoundCount", { count: bulkAddResult.notFound.length })}
                </p>
                <p className="text-sm text-muted-foreground mb-2">
                  {t("match.manualRegisterHelp")}
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
            <CardTitle>{t("match.registerTitle")}</CardTitle>
            <CardDescription>{t("match.registerDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name-input">
                  {t("common.name")} <span className="text-red-500">*</span>
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
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.saving")}
                    </>
                  ) : (
                    t("match.registerButton")
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
          <CardTitle>
            {match.status === "done" ? t("match.paymentStatusTitle") : t("match.registeredPlayersTitle")}
          </CardTitle>
          <CardDescription>
            {match.status === "done"
              ? t("match.paymentStatusDesc")
              : t("match.playersCountDesc", { count: activePlayerCount })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showTeamView ? (
            <>
              {renderPlayerList(teamAPlayers, t("team.a"), "team")}
              {renderPlayerList(teamBPlayers, t("team.b"), "team")}
              {renderPlayerList(unassignedPlayers, t("organize.unassignedTitle"), "team")}
            </>
          ) : (
            renderPlayerList(
              players.filter((p) => p.status === "active"),
              t("match.registeredPlayersTitle"),
              "active",
            )
          )}
          {renderPlayerList(waitlistedPlayers, t("match.waitlistTitle"), "waitlist")}

          {players.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">{t("match.noPlayers")}</div>
          )}
        </CardContent>
      </Card>

      {/* Remove Player Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("match.removePlayerTitle")}</DialogTitle>
            <DialogDescription>
              {t("match.removePlayerConfirm", { name: playerToRemove?.name ?? "" })}
              {!playerToRemove?.has_paid && playerToRemove?.phone && !isAutoGeneratedPhone(playerToRemove.phone)
                ? t("match.confirmWithPhone")
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {playerToRemove?.has_paid ? (
              <p className="text-sm text-destructive">{t("match.removeBlockedPaid")}</p>
            ) : playerToRemove?.phone && !isAutoGeneratedPhone(playerToRemove.phone) ? (
              <div className="space-y-2">
                <Label htmlFor="verification-phone">{t("common.phoneLabel")}</Label>
                <Input
                  id="verification-phone"
                  placeholder={t("common.phonePlaceholder")}
                  value={verificationPhone}
                  onChange={(e) => setVerificationPhone(e.target.value)}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isAutoGeneratedPhone(playerToRemove?.phone || "")
                  ? t("match.noPhoneRegistered")
                  : t("match.phoneNotRequired")}{" "}
                {t("match.confirmToRemove")}
              </p>
            )}
            {!playerToRemove?.has_paid && (
              <p className="text-sm text-muted-foreground">{t("match.removeExplanation")}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)} disabled={removing}>
              {t("common.dismiss")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemovePlayer}
              disabled={removing || !!playerToRemove?.has_paid}
            >
              {removing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.removing")}
                </>
              ) : (
                t("match.removeAction")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("payment.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("payment.dialogDesc", { price: match?.price.toFixed(2) ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Tabs
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as "stripe" | "revolut" | "starling")}
            >
              <TabsList className={`grid w-full ${paymentTabCols}`}>
                {revolutAllowed && (
                  <TabsTrigger value="revolut">
                    <ExternalLink className="mr-1 h-4 w-4" /> {t("payment.revolutTab")}
                  </TabsTrigger>
                )}
                {autoTabAvailable && (
                  <TabsTrigger value="starling-auto">
                    <Sparkles className="mr-1 h-4 w-4" /> {t("payment.autoTab")}
                  </TabsTrigger>
                )}
                <TabsTrigger value="starling">
                  <Landmark className="mr-1 h-4 w-4" />{" "}
                  {autoTabAvailable ? t("payment.refTab") : t("payment.starlingTab")}
                </TabsTrigger>
                <TabsTrigger value="stripe">
                  <CreditCard className="mr-1 h-4 w-4" /> {t("payment.cardTab")}
                </TabsTrigger>
              </TabsList>

              {/* Revolut Payment Tab — only for matches before the 4 June 2026 cutoff */}
              {revolutAllowed && (
              <TabsContent value="revolut" className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border dark:border-gray-800">
                  <div className="text-center mb-4">
                    <p className="font-medium mb-2">{t("payment.revolutHeading")}</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      {t("payment.revolutHelp")}
                    </p>
                    <p className="text-lg font-bold text-green-600 mb-4">£{match?.price.toFixed(2)}</p>
                    <Button
                      onClick={handleRevolutPayment}
                      disabled={processingPayment}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {processingPayment ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.processing")}
                        </>
                      ) : (
                        <>
                          <ExternalLink className="mr-2 h-4 w-4" /> {t("payment.revolutPayButton")}
                        </>
                      )}
                    </Button>
                    <a
                      href="https://revolut.me/kayacanv"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 text-sm text-center text-blue-600 hover:underline dark:text-blue-400 block"
                    >
                      {t("payment.revolutAltLink")}
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
                      {t("payment.alreadyPaid")}
                    </label>
                  </div>
                </div>
              </TabsContent>
              )}

              {/* Starling — automatic matching for players we have seen pay before.
                  No reference: the bank payer name + amount + an open registration
                  identify the payment (payer fallback in app/lib/starling-match.ts). */}
              {autoTabAvailable && (
              <TabsContent value="starling-auto" className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border dark:border-gray-800 space-y-3">
                  <div className="text-center">
                    <p className="font-medium mb-1">{t("payment.autoHeading")}</p>
                    <p className="text-sm text-muted-foreground">{t("payment.autoHelp")}</p>
                    <p className="text-2xl font-bold text-green-600 mt-2">£{match?.price.toFixed(2)}</p>
                    <Button
                      onClick={() => window.open(settleUpUrl, "_blank", "noopener,noreferrer")}
                      className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" /> {t("payment.starlingPayButton")}
                    </Button>
                  </div>

                  {/* The recognised bank name: personal data, so it only comes back
                      from the server when the viewer is this player (or the same
                      account has paid for the viewer too). */}
                  {payerInfo?.names ? (
                    <div className="p-2 rounded-md bg-background border">
                      <p className="text-xs text-muted-foreground">{t("payment.autoKnownName")}</p>
                      <p className="text-sm font-medium">{payerInfo.names[0]}</p>
                      {payerInfo.names.length > 1 && (
                        <p className="text-xs text-muted-foreground">{payerInfo.names.slice(1).join(" · ")}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Lock className="h-3 w-3 shrink-0" /> {t("payment.autoOnlyYou")}
                      </p>
                    </div>
                  ) : payerInfo?.viewerSignedIn ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Lock className="h-3 w-3 shrink-0" /> {t("payment.autoNotShown")}
                    </p>
                  ) : (
                    <Link
                      href="/giris"
                      className="flex items-center gap-2 p-2 rounded-md bg-background border text-sm text-muted-foreground hover:text-foreground"
                    >
                      <LogIn className="h-4 w-4 shrink-0" /> {t("payment.autoLoginToSee")}
                    </Link>
                  )}

                  <div>
                    <p className="text-sm font-medium mb-1">{t("payment.autoHowTitle")}</p>
                    <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
                      <li>{t("payment.autoHowStep1", { price: match?.price.toFixed(2) ?? "" })}</li>
                      <li>{t("payment.autoHowStep2")}</li>
                      <li>{t("payment.autoHowStep3")}</li>
                      <li>{t("payment.autoHowStep4")}</li>
                    </ol>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{t("payment.autoHowFallback")}</p>
                  </div>

                </div>
              </TabsContent>
              )}

              {/* Starling Payment Tab — bank transfer auto-tracked via webhook */}
              <TabsContent value="starling" className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border dark:border-gray-800">
                  {payerInfo && !payerInfo.known && (
                    <p className="text-xs text-muted-foreground mb-3 flex items-start gap-1">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {t("payment.firstTimeNote")}
                    </p>
                  )}
                  {payerInfo?.known && !payerInfo.phoneOnFile && playerToPay && (
                    <Link
                      href={`/profile/${playerToPay.id}`}
                      className="text-xs text-muted-foreground mb-3 flex items-start gap-1 hover:text-foreground"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {t("payment.autoNeedsPhone")}
                    </Link>
                  )}
                  <div className="text-center mb-3">
                    <p className="font-medium mb-1">{t("payment.starlingHeading")}</p>
                    <p className="text-sm text-muted-foreground">{t("payment.starlingHelp")}</p>
                    <p className="text-lg font-bold text-green-600 mt-2">£{match?.price.toFixed(2)}</p>
                    <Button
                      onClick={() => window.open(settleUpUrl, "_blank", "noopener,noreferrer")}
                      className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" /> {t("payment.starlingPayButton")}
                    </Button>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{t("payment.starlingImportant")}</p>
                  </div>

                  {(() => {
                    const ref =
                      playerToPay && match
                        ? paymentRef(match.date, playerToPay.match_player_id, playerToPay.name)
                        : ""
                    const rows: { label: string; value: string; copy?: boolean }[] = [
                      { label: t("payment.starlingAccountName"), value: process.env.NEXT_PUBLIC_STARLING_ACCOUNT_NAME || "—" },
                      { label: t("payment.starlingSortCode"), value: process.env.NEXT_PUBLIC_STARLING_SORT_CODE || "—" },
                      {
                        label: t("payment.starlingAccountNumber"),
                        value: process.env.NEXT_PUBLIC_STARLING_ACCOUNT_NUMBER || "—",
                        copy: true,
                      },
                      { label: t("payment.starlingReference"), value: ref, copy: true },
                    ]
                    return (
                      <div className="space-y-2">
                        {rows.map((r) => (
                          <div
                            key={r.label}
                            className="flex items-center justify-between gap-2 p-2 rounded-md bg-background border"
                          >
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">{r.label}</p>
                              <p className="text-sm font-mono font-medium truncate">{r.value}</p>
                            </div>
                            {r.copy && r.value && r.value !== "—" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => copyToClipboard(r.value, r.label)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })()}

                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">{t("payment.starlingImportant2")}</p>
                </div>
              </TabsContent>

              {/* Stripe Payment Tab */}
              <TabsContent value="stripe" className="space-y-4">
                {stripeError ? (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center border border-red-200 dark:border-red-800">
                    <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400 mx-auto mb-2" />
                    <p className="text-red-700 dark:text-red-400 font-medium">{stripeError}</p>
                    <p className="text-sm text-red-600 dark:text-red-300 mt-2">
                      {t("payment.errorHelp")}
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border dark:border-gray-800 text-center">
                    <p className="font-medium mb-2">{t("payment.stripeHeading")}</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      {t("payment.stripeHelp")}
                    </p>
                    <div className="mb-4">
                      <p className="text-lg font-bold text-blue-600">£{stripePrice.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("payment.stripeFee", { price: match?.price.toFixed(2) ?? "" })}
                      </p>
                    </div>
                    <Button onClick={handleStripeCheckout} disabled={processingPayment} className="w-full">
                      {processingPayment ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.processing")}
                        </>
                      ) : (
                        <>{t("payment.stripePayButton", { price: stripePrice.toFixed(2) })}</>
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
              {t("common.cancel")}
            </Button>
            {paymentMethod === "revolut" && (
              <Button
                onClick={handleManualPaymentConfirmation}
                disabled={!paidWithRevolut || confirmingManualPayment}
                className="bg-green-600 hover:bg-green-700"
              >
                {confirmingManualPayment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.processing")}
                  </>
                ) : (
                  t("common.ok")
                )}
              </Button>
            )}
            {(paymentMethod === "starling" || paymentMethod === "starling-auto") && (
              <Button
                onClick={handleCheckStarlingPayment}
                disabled={checkingStarling}
                className="bg-green-600 hover:bg-green-700"
              >
                {checkingStarling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.checking")}
                  </>
                ) : (
                  t("payment.checkPaymentButton")
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
            <DialogTitle>{t("match.confirmUserTitle")}</DialogTitle>
            <DialogDescription>
              {t("match.confirmUserDesc", { name: userToConfirm?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)} disabled={confirming}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleConfirmUser} disabled={confirming} className="bg-green-600 hover:bg-green-700">
              {confirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.approving")}
                </>
              ) : (
                t("common.approve")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkAddDialogOpen} onOpenChange={setBulkAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("match.bulkAddTitle")}</DialogTitle>
            <DialogDescription>{t("match.bulkAddHelp")}</DialogDescription>
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
              {t("common.cancel")}
            </Button>
            <Button onClick={handleBulkAdd} disabled={bulkAdding}>
              {bulkAdding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.adding")}
                </>
              ) : (
                t("match.addPlayers")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  )
}
