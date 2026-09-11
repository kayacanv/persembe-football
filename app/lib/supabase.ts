import { createClient } from "@supabase/supabase-js"
import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr"
import { isBrowser } from "./utils/environment"

// Create a single supabase client for the browser.
// `@supabase/ssr`'s browser client stores the auth session in cookies rather than
// localStorage, so the same session is visible to middleware, server actions and
// (later) Row Level Security. Anonymous visitors are unaffected — there is simply
// no session cookie.
const createBrowserClient = () => {
  if (!isBrowser) {
    return null
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase URL or Anon Key is missing")
    return null
  }

  return createSsrBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Create a singleton instance for the client
let browserClient: ReturnType<typeof createSsrBrowserClient> | null = null

export const getSupabaseBrowserClient = () => {
  if (!isBrowser) {
    return null
  }

  if (!browserClient) {
    browserClient = createBrowserClient()
  }
  return browserClient
}

// Create a server client (for server components or server actions).
// Service-role key: bypasses RLS, never reaches the browser. For a *session-aware*
// server client (the signed-in player's own identity) use getSessionClient() in
// app/lib/supabase-ssr.ts instead.
export const createServerClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Supabase URL or Service Key is missing")
    return null
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}
