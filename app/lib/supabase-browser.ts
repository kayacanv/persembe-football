// Historical duplicate of the browser client (app/page.tsx imports from here).
// Kept as a re-export so there is exactly one singleton — and therefore exactly
// one auth session — in the browser.
export { getSupabaseBrowserClient } from "./supabase"
