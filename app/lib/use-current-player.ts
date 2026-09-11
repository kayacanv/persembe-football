"use client"

// Who is signed in, from a client component's point of view.
//
// The session lives in a cookie, so the source of truth is the server: this hook
// asks a server action rather than trusting anything in the browser. It re-asks
// whenever the browser client reports an auth change, and exposes `refresh` for
// the cases the browser client cannot see — a sign-in performed by a server
// action, where the cookie changes underneath it.

import { useCallback, useEffect, useState } from "react"
import { getMyPlayer } from "../actions/auth-actions"
import { getSupabaseBrowserClient } from "./supabase"
import type { CurrentPlayer } from "./supabase-ssr"

export type { CurrentPlayer }

export function useCurrentPlayer() {
  const [player, setPlayer] = useState<CurrentPlayer | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      // Let the browser client re-read the session cookie first, so its own
      // listeners stay in step with what the server is about to tell us.
      await getSupabaseBrowserClient()?.auth.getSession()
      setPlayer(await getMyPlayer())
    } catch (error) {
      console.error("Error loading current player:", error)
      setPlayer(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      setLoading(false)
      return
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (active) void refresh()
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [refresh])

  return { player, loading, refresh }
}
