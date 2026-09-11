// Server-only Supabase helpers. Never import this from a client component —
// it reads the Next.js request cookies via next/headers.
//
// Two server clients exist, with different jobs:
//   - createServerClient()  (app/lib/supabase.ts) — service-role key, no session.
//     Used for privileged reads/writes and auth.admin.* calls.
//   - getSessionClient()    (here) — anon key plus the caller's cookies. This is
//     the one that can read auth.uid() and the one that must be used for
//     signInWithPassword / signOut so the session cookie is actually written.

import { cookies } from "next/headers"
import { createServerClient as createSsrServerClient } from "@supabase/ssr"

export type CurrentPlayer = {
  id: string
  name: string
  username: string | null
  photo_url: string | null
}

// Cookie-aware client bound to the current request. `setAll` throws when called
// from a Server Component (cookies are read-only there); that is expected and
// harmless, because middleware refreshes the session cookie on every request.
export async function getSessionClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase URL or Anon Key is missing")
    return null
  }

  const cookieStore = await cookies()

  return createSsrServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component — middleware will refresh instead.
        }
      },
    },
  })
}

// The public.users row behind the current session, or null when signed out.
// Deliberately does NOT select `phone`: numbers are write-only (app/lib/phone.ts).
export async function getCurrentPlayer(): Promise<CurrentPlayer | null> {
  const supabase = await getSessionClient()
  if (!supabase) return null

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from("users")
    .select("id, name, username, photo_url")
    .eq("auth_id", user.id)
    .maybeSingle()

  if (error) {
    console.error("Error loading current player:", error.message)
    return null
  }

  return (data as CurrentPlayer | null) ?? null
}
