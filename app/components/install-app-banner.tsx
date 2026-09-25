"use client"

// Home-page nudge to add the site to the phone's home screen. Android / desktop
// Chrome get a one-tap install button; iPhone users get the Share → "Add to Home
// Screen" steps, since Safari has no install API. Hidden once the app is running
// installed, or after the player dismisses it.

import { useEffect, useState, useSyncExternalStore } from "react"
import { Download, Share, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getInstallPrompt, isIos, isStandalone, promptInstall, subscribeInstallPrompt } from "@/app/lib/pwa"
import { useTranslation } from "@/lib/i18n/useTranslation"

const DISMISSED_KEY = "install-banner-dismissed"

export function InstallAppBanner() {
  const { t } = useTranslation()
  const installPrompt = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt, () => null)
  // Browser-only checks run after mount so the server render (nothing) matches.
  const [platform, setPlatform] = useState<"ios" | "other" | null>(null)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    if (isStandalone()) return
    setPlatform(isIos() ? "ios" : "other")
    try {
      setDismissed(window.localStorage.getItem(DISMISSED_KEY) !== null)
    } catch {
      setDismissed(false)
    }
  }, [])

  const dismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1")
    } catch {
      // Private mode: the banner simply comes back next visit.
    }
  }

  if (dismissed || platform === null) return null
  if (platform === "other" && !installPrompt) return null

  return (
    <Card className="mb-6 border-green-300 dark:border-green-800">
      <CardContent className="flex items-start gap-3 p-4">
        <img src="/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t("pwa.bannerTitle")}</p>
          {platform === "ios" ? (
            <p className="text-sm text-muted-foreground">
              {t("pwa.iosTapShare")} <Share className="inline h-4 w-4 align-text-bottom" aria-label={t("pwa.share")} />{" "}
              {t("pwa.iosAddToHome")}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t("pwa.bannerDescription")}</p>
              <Button size="sm" className="mt-3" onClick={() => void promptInstall()}>
                <Download className="h-4 w-4" />
                {t("pwa.install")}
              </Button>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("pwa.dismiss")}
          className="-m-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  )
}
