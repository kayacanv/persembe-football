"use client"

// The "My Account" tab body (also rendered standalone at /giris).
//
// Two modes on one card, mobile-first (baseline 390px):
//   - sign in: username + password
//   - create password: claim the player row that is already yours
//
// Claiming is trust-on-first-use with a phone check. The number is only ever
// sent upwards — nothing here fetches or displays an existing one.

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { CheckCircle2, Heart, KeyRound, Vote, Loader2, LogIn, LogOut, Search, UserRound, X } from "lucide-react"
import { CountryPhoneInput } from "@/app/components/phone-input"
import {
  claimAccount,
  getClaimableUsers,
  signIn,
  signOut,
  type ClaimableUser,
  type ClaimResult,
} from "@/app/actions/auth-actions"
import { countMyTeammatePreferences } from "@/app/actions/preference-actions"
import { DEFAULT_DIAL } from "@/app/lib/phone"
import { isValidUsername, normalizeUsername, suggestUsername } from "@/app/lib/username"
import { useCurrentPlayer } from "@/app/lib/use-current-player"
import { useTranslation } from "@/lib/i18n/useTranslation"

type Mode = "signin" | "claim"
type Status = { type: "success" | "error"; msg: string } | null

// Server reasons → i18n keys. Deliberately coarse: "mismatch" must not hint at
// which of the name/number was wrong.
const CLAIM_ERROR_KEYS: Record<Extract<ClaimResult, { ok: false }>["reason"], string> = {
  mismatch: "auth.errMismatch",
  already_claimed: "auth.errAlreadyClaimed",
  duplicate: "auth.errDuplicate",
  throttled: "auth.errThrottled",
  bad_username: "auth.errBadUsername",
  bad_password: "auth.errBadPassword",
  invalid: "auth.errGeneric",
  error: "auth.errGeneric",
}

export function AccountPanel() {
  const { t } = useTranslation()
  const { player, loading, refresh } = useCurrentPlayer()

  const [mode, setMode] = useState<Mode>("signin")
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  // Signed in with no teammate preferences yet → nudge towards the profile tab.
  const [prefCount, setPrefCount] = useState<number | null>(null)
  useEffect(() => {
    if (!player) {
      setPrefCount(null)
      return
    }
    let active = true
    countMyTeammatePreferences()
      .then((n) => active && setPrefCount(n))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [player?.id])

  // sign-in fields
  const [loginUsername, setLoginUsername] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  // claim fields
  const [claimable, setClaimable] = useState<ClaimableUser[]>([])
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<ClaimableUser | null>(null)
  const [dial, setDial] = useState(DEFAULT_DIAL)
  const [national, setNational] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")

  // The claimable list is only needed once the claim mode is opened.
  useEffect(() => {
    if (mode !== "claim" || claimable.length > 0) return
    getClaimableUsers().then(setClaimable).catch(() => setClaimable([]))
  }, [mode, claimable.length])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return claimable
    return claimable.filter((u) => u.name.toLowerCase().includes(q))
  }, [claimable, search])

  const usernameTouched = normalizeUsername(username)
  const usernameOk = isValidUsername(usernameTouched)

  function switchMode(next: Mode) {
    setMode(next)
    setStatus(null)
  }

  function selectPlayer(user: ClaimableUser) {
    setSelected(user)
    setStatus(null)
    setUsername(suggestUsername(user.name))
  }

  async function handleSignIn() {
    setStatus(null)
    if (!loginUsername.trim() || !loginPassword) {
      setStatus({ type: "error", msg: t("auth.errInvalidCredentials") })
      return
    }

    setSubmitting(true)
    try {
      const res = await signIn({ username: loginUsername, password: loginPassword })
      if (res.ok) {
        setLoginUsername("")
        setLoginPassword("")
        await refresh()
      } else {
        setStatus({
          type: "error",
          msg: t(res.reason === "invalid_credentials" ? "auth.errInvalidCredentials" : "auth.errGeneric"),
        })
      }
    } catch (error) {
      console.error("Sign-in error:", error)
      setStatus({ type: "error", msg: t("auth.errGeneric") })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleClaim() {
    setStatus(null)
    if (!selected) return
    if (!national.trim()) {
      setStatus({ type: "error", msg: t("contact.errorPhoneRequired") })
      return
    }
    if (!usernameOk) {
      setStatus({ type: "error", msg: t("auth.errBadUsername") })
      return
    }
    if (password.length < 8) {
      setStatus({ type: "error", msg: t("auth.errBadPassword") })
      return
    }
    if (password !== confirm) {
      setStatus({ type: "error", msg: t("auth.passwordMismatch") })
      return
    }

    setSubmitting(true)
    try {
      const res = await claimAccount({
        userId: selected.id,
        dial,
        national,
        username: usernameTouched,
        password,
      })
      if (res.ok) {
        setSelected(null)
        setSearch("")
        setNational("")
        setUsername("")
        setPassword("")
        setConfirm("")
        setClaimable([])
        setMode("signin")
        setStatus({ type: "success", msg: t("auth.claimSuccess") })
        await refresh()
      } else {
        setStatus({ type: "error", msg: t(CLAIM_ERROR_KEYS[res.reason]) })
      }
    } catch (error) {
      console.error("Claim error:", error)
      setStatus({ type: "error", msg: t("auth.errGeneric") })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSignOut() {
    setSubmitting(true)
    setStatus(null)
    try {
      await signOut()
      await refresh()
      setStatus({ type: "success", msg: t("auth.signedOut") })
    } catch (error) {
      console.error("Sign-out error:", error)
      setStatus({ type: "error", msg: t("auth.errGeneric") })
    } finally {
      setSubmitting(false)
    }
  }

  const statusBanner = status && (
    <div
      className={
        status.type === "success"
          ? "flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300"
          : "flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
      }
    >
      {status.type === "success" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <X className="h-4 w-4 shrink-0" />
      )}
      <span>{status.msg}</span>
    </div>
  )

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
          <div>{t("common.loading")}</div>
        </CardContent>
      </Card>
    )
  }

  if (player) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("auth.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-3">
            <p className="font-medium">{t("auth.signedInAs", { name: player.name })}</p>
            {player.username && <p className="text-sm text-muted-foreground">@{player.username}</p>}
          </div>
          {statusBanner}
          {prefCount === 0 && (
            <div className="space-y-2 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/40">
              <p className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-200">
                <Heart className="h-4 w-4 shrink-0" /> {t("prefs.nudgeTitle")}
              </p>
              <p className="text-xs text-green-700 dark:text-green-300">{t("prefs.nudgeDesc")}</p>
              <Button asChild size="sm" className="w-full bg-green-600 hover:bg-green-700">
                <Link href={`/profile/${player.id}?tab=preferences`}>{t("prefs.nudgeButton")}</Link>
              </Button>
            </div>
          )}
          <Button asChild variant="outline" className="w-full">
            <Link href="/oyla">
              <Vote className="mr-2 h-4 w-4" />
              {t("rate.title")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/profile/${player.id}`}>
              <UserRound className="mr-2 h-4 w-4" />
              {t("auth.myProfile")}
            </Link>
          </Button>
          <Button variant="outline" className="w-full" onClick={handleSignOut} disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            {t("auth.signOut")}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "signin" ? t("auth.signIn") : t("auth.createPassword")}</CardTitle>
        <CardDescription>{mode === "signin" ? t("auth.signInDesc") : t("auth.createDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {mode === "signin" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auth-username">{t("auth.username")}</Label>
              <Input
                id="auth-username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password">{t("auth.password")}</Label>
              <Input
                id="auth-password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="current-password"
                disabled={submitting}
              />
            </div>

            {statusBanner}

            <Button className="w-full" onClick={handleSignIn} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("auth.submitting")}
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" /> {t("auth.signIn")}
                </>
              )}
            </Button>

            <Button variant="link" className="h-auto w-full p-0 text-sm" onClick={() => switchMode("claim")}>
              {t("auth.noPasswordYet")}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Step 1 — which player are you? */}
            {selected ? (
              <div className="flex items-center justify-between gap-2 rounded-md border p-3">
                <span className="min-w-0 truncate font-medium">{selected.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setSelected(null)}
                  disabled={submitting}
                >
                  <X className="mr-1 h-4 w-4" />
                  {t("contact.changePlayer")}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="auth-search">{t("auth.pickYourName")}</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="auth-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("common.searchName")}
                    className="pl-9"
                  />
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1">
                  {filtered.length > 0 ? (
                    filtered.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => selectPlayer(u)}
                        className="w-full rounded px-3 py-2 text-left hover:bg-muted"
                      >
                        <span className="block text-sm">{u.name}</span>
                        {u.memberSince && (
                          <span className="block text-xs text-muted-foreground">
                            {t("auth.memberSince", { year: u.memberSince })}
                          </span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">{t("common.playerNotFound")}</div>
                  )}
                </div>
              </div>
            )}

            {selected && (
              <>
                {/* Step 2 — confirm (or record) the phone number */}
                <div className="space-y-2">
                  <Label htmlFor="auth-phone">{t("common.phoneLabel")}</Label>
                  <CountryPhoneInput
                    id="auth-phone"
                    dial={dial}
                    national={national}
                    onDialChange={setDial}
                    onNationalChange={setNational}
                    placeholder={t("common.phonePlaceholder")}
                    disabled={submitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    {selected.hasPhone ? t("auth.phoneHintHasPhone") : t("auth.phoneHintNoPhone")}
                  </p>
                </div>

                {/* Step 3 — the login handle and password */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="auth-new-username">{t("auth.username")}</Label>
                    <Input
                      id="auth-new-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      disabled={submitting}
                    />
                    <p
                      className={
                        username && !usernameOk
                          ? "text-xs text-red-600 dark:text-red-400"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {t("auth.usernameHint")}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="auth-new-password">{t("auth.password")}</Label>
                    <Input
                      id="auth-new-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      disabled={submitting}
                    />
                    <p className="text-xs text-muted-foreground">{t("auth.passwordHint")}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="auth-confirm-password">{t("auth.confirmPassword")}</Label>
                    <Input
                      id="auth-confirm-password"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="new-password"
                      disabled={submitting}
                    />
                  </div>
                </div>
              </>
            )}

            {statusBanner}

            <Button className="w-full" onClick={handleClaim} disabled={submitting || !selected}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("auth.submitting")}
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" /> {t("auth.createPassword")}
                </>
              )}
            </Button>

            <Button variant="link" className="h-auto w-full p-0 text-sm" onClick={() => switchMode("signin")}>
              {t("auth.haveAccount")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default AccountPanel
