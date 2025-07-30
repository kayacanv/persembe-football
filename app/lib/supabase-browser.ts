import { createClient } from "@supabase/supabase-js"
import { isBrowser } from "./utils/environment"

// Create a single supabase client for the browser
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

  return createClient(supabaseUrl, supabaseAnonKey)
}

// Create a singleton instance for the client
let browserClient: ReturnType<typeof createClient> | null = null

export const getSupabaseBrowserClient = () => {
  if (!isBrowser) {
    return null
  }

  if (!browserClient) {
    browserClient = createBrowserClient()
  }
  return browserClient
}
