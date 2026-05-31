"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, Loader2, Lock, Search, UserPlus, X } from "lucide-react"
import { CountryPhoneInput } from "@/app/components/phone-input"
import { createUserWithPhone, getUserNames, setUserPhone } from "@/app/lib/data-service"
import { DEFAULT_DIAL, toE164 } from "@/app/lib/phone"
import { useTranslation } from "@/lib/i18n/useTranslation"

type Mode = "new" | "existing"
type Status = { type: "success" | "error"; msg: string } | null
type NamedUser = { id: string; name: string }

// The home "Contact" tab body. Two flows that both write a canonical E.164 phone:
//  - "new": create a brand-new player with their number on file
//  - "existing": attach a number to an already-registered player (picked by name)
// Numbers are write-only here — no existing number is ever fetched or shown.
export function PhoneRegistration() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>("new")

  // shared phone field
  const [dial, setDial] = useState(DEFAULT_DIAL)
  const [national, setNational] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  // "new" mode
  const [name, setName] = useState("")

  // "existing" mode
  const [users, setUsers] = useState<NamedUser[]>([])
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<NamedUser | null>(null)

  useEffect(() => {
    // Names only — phone numbers are never pulled into the client (privacy).
    getUserNames().then(setUsers)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users.slice(0, 8)
    return users.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 8)
  }, [users, search])

  function switchMode(next: Mode) {
    setMode(next)
    setStatus(null)
    setNational("")
    setDial(DEFAULT_DIAL)
    setName("")
    setSearch("")
    setSelected(null)
  }

  function resetAfterSuccess() {
    setNational("")
    setName("")
    setSearch("")
    setSelected(null)
  }

  async function handleSubmit() {
    setStatus(null)
    const phone = toE164(dial, national)
    if (!phone) {
      setStatus({ type: "error", msg: t("contact.errorPhoneRequired") })
      return
    }

    setSubmitting(true)
    try {
      if (mode === "new") {
        if (!name.trim()) {
          setStatus({ type: "error", msg: t("contact.errorNameRequired") })
          return
        }
        const res = await createUserWithPhone(name, phone)
        if (res.ok) {
          setStatus({ type: "success", msg: t("contact.successNew", { name: name.trim() }) })
          resetAfterSuccess()
        } else {
          setStatus({
            type: "error",
            msg: res.reason === "duplicate" ? t("contact.errorDuplicate") : t("contact.errorGeneric"),
          })
        }
      } else {
        if (!selected) {
          setStatus({ type: "error", msg: t("contact.errorSelectPlayer") })
          return
        }
        const res = await setUserPhone(selected.id, phone)
        if (res.ok) {
          setStatus({ type: "success", msg: t("contact.successExisting", { name: selected.name }) })
          resetAfterSuccess()
        } else {
          setStatus({
            type: "error",
            msg: res.reason === "duplicate" ? t("contact.errorDuplicate") : t("contact.errorGeneric"),
          })
        }
      }
    } catch (err) {
      console.error("Phone registration error:", err)
      setStatus({ type: "error", msg: t("contact.errorGeneric") })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("contact.title")}</CardTitle>
        <CardDescription>{t("contact.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Privacy note */}
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("contact.privacyNote")}</span>
        </div>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={mode === "new" ? "default" : "outline"}
            onClick={() => switchMode("new")}
          >
            {t("contact.modeNew")}
          </Button>
          <Button
            type="button"
            variant={mode === "existing" ? "default" : "outline"}
            onClick={() => switchMode("existing")}
          >
            {t("contact.modeExisting")}
          </Button>
        </div>

        {mode === "new" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">{t("common.name")}</Label>
              <Input
                id="contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("common.namePlaceholderExample")}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone-new">{t("common.phoneLabel")}</Label>
              <CountryPhoneInput
                id="contact-phone-new"
                dial={dial}
                national={national}
                onDialChange={setDial}
                onNationalChange={setNational}
                placeholder={t("common.phonePlaceholder")}
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground">{t("contact.whatsappHint")}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {selected ? (
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="font-medium">{selected.name}</span>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)} disabled={submitting}>
                  <X className="mr-1 h-4 w-4" />
                  {t("contact.changePlayer")}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="contact-search">{t("contact.selectPlayerLabel")}</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="contact-search"
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
                        onClick={() => {
                          setSelected(u)
                          setStatus(null)
                        }}
                        className="w-full rounded px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        {u.name}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">{t("common.playerNotFound")}</div>
                  )}
                </div>
              </div>
            )}

            {selected && (
              <div className="space-y-2">
                <Label htmlFor="contact-phone-existing">{t("common.phoneLabel")}</Label>
                <CountryPhoneInput
                  id="contact-phone-existing"
                  dial={dial}
                  national={national}
                  onDialChange={setDial}
                  onNationalChange={setNational}
                  placeholder={t("common.phonePlaceholder")}
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">{t("contact.whatsappHint")}</p>
              </div>
            )}
          </div>
        )}

        {status && (
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
        )}

        <Button
          type="button"
          className="w-full"
          onClick={handleSubmit}
          disabled={submitting || (mode === "existing" && !selected)}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.saving")}
            </>
          ) : (
            <>
              <UserPlus className="mr-2 h-4 w-4" />
              {mode === "new" ? t("contact.registerButton") : t("contact.saveButton")}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

export default PhoneRegistration
