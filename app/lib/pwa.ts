// Client-side helpers for the installable (PWA) version of the site.
//
// Chrome, Edge and Samsung Internet fire `beforeinstallprompt` once per page load,
// often before React has hydrated, so the event is captured here at module load
// (this module is pulled in by the root layout) and kept for the install banner.
// Safari (iOS) never fires it; players there add the app from the Share menu.

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep the browser's own mini-infobar away; the home page shows our banner.
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null
    notify()
  })
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt
}

/** Shows the browser's install dialog. The event can be used only once. */
export async function promptInstall(): Promise<boolean> {
  const event = deferredPrompt
  if (!event) return false
  deferredPrompt = null
  notify()
  await event.prompt()
  const { outcome } = await event.userChoice
  return outcome === "accepted"
}

/** True when the site is running as the installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** iPhone / iPad, including iPadOS that reports itself as a Mac. */
export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

export function registerServiceWorker(): void {
  // Production only: in `next dev` a worker would serve stale chunks across edits.
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
  navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error) => {
    console.error("Service worker registration failed:", error)
  })
}
