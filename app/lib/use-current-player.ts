"use client"

// Who is signed in, from a client component's point of view.
//
// The session lives in a cookie, so the source of truth is the server: this hook
// asks a server action rather than trusting anything in the browser. It re-asks
// whenever the browser client reports an auth change, and exposes `refresh` for
// the cases the browser client cannot see — a sign-in or sign-out performed by a
// server action, where the cookie changes underneath it.

import { useCallback, useEffect, useRef, useState } from "react"
import { getMyPlayer } from "../actions/auth-actions"
import { getSupabaseBrowserClient } from "./supabase"
import type { CurrentPlayer } from "./supabase-ssr"

export type { CurrentPlayer }

// Every mounted copy of the hook, so that one component signing in or out also
// updates the others — the account panel and the header badge, for instance.
const subscribers = new Set<() => void>()

export function useCurrentPlayer() {
  const [player, setPlayer] = useState<CurrentPlayer | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
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

  const loadRef = useRef(load)
  loadRef.current = load

  // This copy's own entry in `subscribers`, so refreshing does not re-notify it.
  const selfRef = useRef<(() => void) | null>(null)

  const refresh = useCallback(async () => {
    await load()
    for (const notify of subscribers) {
      if (notify !== selfRef.current) notify()
    }
  }, [load])

  useEffect(() => {
    let active = true
    const notify = () => {
      if (active) void loadRef.current()
    }
    selfRef.current = notify
    subscribers.add(notify)

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      setLoading(false)
      return () => {
        active = false
        subscribers.delete(notify)
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => notify())

    return () => {
      active = false
      subscribers.delete(notify)
      subscription.unsubscribe()
    }
  }, [])

  return { player, loading, refresh }
}
