"use client"

// Rendered once from the root layout: registers public/sw.js and, by importing
// app/lib/pwa, starts listening for the install prompt on every page.

import { useEffect } from "react"
import { registerServiceWorker } from "@/app/lib/pwa"

export function ServiceWorkerRegistration() {
  useEffect(() => {
    registerServiceWorker()
  }, [])

  return null
}
