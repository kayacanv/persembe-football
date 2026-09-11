"use server"

// Account claiming and sign-in.
//
// Model: every player already exists as a public.users row (referenced by
// match_players, mvp_votes, payments). Logging in never creates a second
// identity — it links an auth.users row to the existing player via
// users.auth_id. The auth identity is the player's E.164 phone; the username is
// only a handle so phones are never typed into a login form or sent to a browser.
//
// Privacy rule: no value returned from this module may contain phone digits.

import { createServerClient } from "../lib/supabase"
import { getCurrentPlayer, getSessionClient } from "../lib/supabase-ssr"
import { isPlaceholderPhone, toE164 } from "../lib/phone"
import { isValidUsername, normalizeUsername } from "../lib/username"

const UNIQUE_VIOLATION = "23505"
const MIN_PASSWORD_LENGTH = 8
const THROTTLE_WINDOW_MINUTES = 15
const THROTTLE_MAX_ATTEMPTS = 5

// Guest rows are created for one-off ringers and are named after their inviter,
// e.g. "Paulo (baris+1)". They are not people who can own an account.
const GUEST_NAME_PATTERN = /\(.*\+\d+\)\s*$/

export type ClaimableUser = {
  id: string
  name: string
  hasPhone: boolean
  memberSince: string
}

export type ClaimResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | "throttled"
        | "already_claimed"
        | "invalid"
        | "mismatch"
        | "bad_username"
        | "bad_password"
        | "duplicate"
        | "error"
    }

export type SignInResult = { ok: true } | { ok: false; reason: "invalid_credentials" | "error" }

// Players who could still claim an account: real members, not already claimed.
// `hasPhone` drives the wording of the phone step; `memberSince` is what tells
// two players with the same name apart. The phone itself never leaves the server.
export async function getClaimableUsers(): Promise<ClaimableUser[]> {
  const supabase = createServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("users")
    .select("id, name, phone, auth_id, created_at")
    .is("auth_id", null)
    .order("name")

  if (error) {
    console.error("Error loading claimable users:", error.message)
    return []
  }

  return (data || [])
    .filter((u: any) => !GUEST_NAME_PATTERN.test(u.name || ""))
    .map((u: any) => ({
      id: u.id,
      name: u.name,
      hasPhone: !isPlaceholderPhone(u.phone),
      memberSince: u.created_at ? String(new Date(u.created_at).getFullYear()) : "",
    }))
}

// Trust on first use, with a phone check: if we already hold a real number for
// this player, the typed one must match it. If we only hold a placeholder, the
// typed number becomes theirs (which also backfills the WhatsApp bot's roster).
export async function claimAccount(input: {
  userId: string
  dial: string
  national: string
  username: string
  password: string
}): Promise<ClaimResult> {
  const supabase = createServerClient()
  if (!supabase) return { ok: false, reason: "error" }

  const { userId, dial, national, password } = input

  // 1. Throttle per target player, so a claimed-but-guessable name cannot be
  //    brute-forced by trying numbers.
  const since = new Date(Date.now() - THROTTLE_WINDOW_MINUTES * 60_000).toISOString()
  const { count } = await supabase
    .from("claim_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("attempted_at", since)

  if ((count ?? 0) >= THROTTLE_MAX_ATTEMPTS) return { ok: false, reason: "throttled" }

  const { data: attempt } = await supabase
    .from("claim_attempts")
    .insert({ user_id: userId })
    .select("id")
    .single()

  const markSucceeded = async () => {
    if (!attempt?.id) return
    await supabase.from("claim_attempts").update({ succeeded: true }).eq("id", attempt.id)
  }

  // 2. The target player must exist, be unclaimed and be a real member.
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, phone, auth_id")
    .eq("id", userId)
    .maybeSingle()

  if (userError) {
    console.error("Error loading user for claim:", userError.message)
    return { ok: false, reason: "error" }
  }
  if (!user) return { ok: false, reason: "invalid" }
  if (user.auth_id) return { ok: false, reason: "already_claimed" }
  if (GUEST_NAME_PATTERN.test(user.name || "")) return { ok: false, reason: "invalid" }

  // 3–4. Phone: either confirm the number on file or adopt the typed one.
  const phone = toE164(dial, national)
  if (!phone) return { ok: false, reason: "invalid" }

  const hasRealPhone = !isPlaceholderPhone(user.phone)
  // Deliberately generic: never reveal whether the name or the number was wrong.
  if (hasRealPhone && user.phone !== phone) return { ok: false, reason: "mismatch" }

  // 5. Credentials.
  const username = normalizeUsername(input.username)
  if (!isValidUsername(username)) return { ok: false, reason: "bad_username" }
  if (!password || password.length < MIN_PASSWORD_LENGTH) return { ok: false, reason: "bad_password" }

  // 6. Create the auth user. phone_confirm skips SMS entirely — there is no SMS
  //    provider configured and the number was already verified against our records.
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    phone,
    password,
    phone_confirm: true,
    user_metadata: { user_id: userId, username },
  })

  if (createError || !created?.user) {
    // Supabase rejects a phone that already belongs to another auth user.
    if (createError?.status === 422 || createError?.code === "phone_exists") {
      return { ok: false, reason: "duplicate" }
    }
    console.error("Error creating auth user:", createError?.message)
    return { ok: false, reason: "error" }
  }

  const authId = created.user.id

  // 7. Link it to the player row. `auth_id is null` in the filter makes this a
  //    compare-and-set, so two simultaneous claims cannot both win.
  const { data: linked, error: linkError } = await supabase
    .from("users")
    .update({ auth_id: authId, username, phone })
    .eq("id", userId)
    .is("auth_id", null)
    .select("id")

  if (linkError || !linked || linked.length === 0) {
    // Never leave an orphan auth user behind — it would hold the phone hostage.
    await supabase.auth.admin.deleteUser(authId)
    if (linkError?.code === UNIQUE_VIOLATION) return { ok: false, reason: "duplicate" }
    if (linkError) {
      console.error("Error linking auth user to player:", linkError.message)
      return { ok: false, reason: "error" }
    }
    return { ok: false, reason: "already_claimed" }
  }

  await markSucceeded()

  // 8. Sign them straight in — the cookie client is the one that writes the session.
  const sessionClient = await getSessionClient()
  if (sessionClient) {
    const { error: signInError } = await sessionClient.auth.signInWithPassword({ phone, password })
    if (signInError) console.error("Post-claim sign-in failed:", signInError.message)
  }

  return { ok: true }
}

// Username → stored phone → password sign-in. The phone is resolved server-side
// and never round-trips through the browser.
export async function signIn(input: { username: string; password: string }): Promise<SignInResult> {
  const username = normalizeUsername(input.username)
  if (!username || !input.password) return { ok: false, reason: "invalid_credentials" }

  const supabase = createServerClient()
  if (!supabase) return { ok: false, reason: "error" }

  const { data: user, error } = await supabase
    .from("users")
    .select("phone, auth_id")
    .eq("username", username)
    .maybeSingle()

  if (error) {
    console.error("Error resolving username:", error.message)
    return { ok: false, reason: "error" }
  }
  // Same answer for "no such handle" as for "wrong password" — no enumeration.
  if (!user || !user.auth_id || isPlaceholderPhone(user.phone)) {
    return { ok: false, reason: "invalid_credentials" }
  }

  const sessionClient = await getSessionClient()
  if (!sessionClient) return { ok: false, reason: "error" }

  const { error: signInError } = await sessionClient.auth.signInWithPassword({
    phone: user.phone,
    password: input.password,
  })

  if (signInError) return { ok: false, reason: "invalid_credentials" }

  return { ok: true }
}

export async function signOut(): Promise<{ ok: boolean }> {
  const sessionClient = await getSessionClient()
  if (!sessionClient) return { ok: false }

  const { error } = await sessionClient.auth.signOut()
  if (error) {
    console.error("Sign-out failed:", error.message)
    return { ok: false }
  }
  return { ok: true }
}

// Server-side replacement for the old anon-key phone write. Keeps auth.users in
// step with public.users so a claimed player can still sign in after changing
// their number.
export type PhoneUpdateResult = { ok: true; userId: string } | { ok: false; reason: "duplicate" | "error" }

export async function updatePhone(userId: string, dial: string, national: string): Promise<PhoneUpdateResult> {
  const phone = toE164(dial, national)
  if (!phone) return { ok: false, reason: "error" }

  const supabase = createServerClient()
  if (!supabase) return { ok: false, reason: "error" }

  const { data: user, error: loadError } = await supabase
    .from("users")
    .select("auth_id, phone")
    .eq("id", userId)
    .maybeSingle()

  if (loadError) {
    console.error("Error loading user for phone update:", loadError.message)
    return { ok: false, reason: "error" }
  }
  if (!user) return { ok: false, reason: "error" }

  const previousPhone: string = user.phone

  const { error } = await supabase.from("users").update({ phone }).eq("id", userId)

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { ok: false, reason: "duplicate" }
    console.error("Error updating phone:", error.message)
    return { ok: false, reason: "error" }
  }

  if (user.auth_id) {
    const { error: authError } = await supabase.auth.admin.updateUserById(user.auth_id, {
      phone,
      phone_confirm: true,
    })
    if (authError) {
      // The two stores must agree — a player whose auth phone is stale can no
      // longer sign in. Put the old number back rather than leave them split.
      await supabase.from("users").update({ phone: previousPhone }).eq("id", userId)
      console.error("Error syncing phone to auth user:", authError.message)
      return { ok: false, reason: authError.status === 422 ? "duplicate" : "error" }
    }
  }

  return { ok: true, userId }
}

// Create a brand-new player with a phone on file (the Contact tab's "new player"
// flow). Server-side so the anon key never writes a phone number.
export type CreatePlayerResult = { ok: true; userId: string } | { ok: false; reason: "duplicate" | "error" }

export async function createPlayerWithPhone(
  name: string,
  dial: string,
  national: string,
): Promise<CreatePlayerResult> {
  const trimmed = (name || "").trim()
  const phone = toE164(dial, national)
  if (!trimmed || !phone) return { ok: false, reason: "error" }

  const supabase = createServerClient()
  if (!supabase) return { ok: false, reason: "error" }

  const { data, error } = await supabase
    .from("users")
    .insert({ name: trimmed, phone, position: "", power: 5, position_weight: 3 })
    .select("id")
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { ok: false, reason: "duplicate" }
    console.error("Error creating player with phone:", error.message)
    return { ok: false, reason: "error" }
  }

  return { ok: true, userId: data.id }
}

// Client-callable view of the signed-in player. Thin wrapper over the server
// helper so client components can render an auth state without a page reload.
export async function getMyPlayer() {
  return getCurrentPlayer()
}
