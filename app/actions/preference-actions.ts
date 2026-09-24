"use server"

// Teammate preferences (migration add-teammate-preferences.sql).
//
// A signed-in player marks regulars as "want" or "ok"; no row means "no
// preference". Votes are private: every read here is scoped to the session's
// own player, so nobody can see who picked them or who picked anyone else.
//
// Who can be picked: players with a real phone on file (the WhatsApp-reachable
// members, account or not) who played in at least MIN_RECENT_MATCHES of the
// last RECENT_MATCH_WINDOW finished matches.

import { createServerClient } from "../lib/supabase"
import { getCurrentPlayer } from "../lib/supabase-ssr"
import { isPlaceholderPhone } from "../lib/phone"

const RECENT_MATCH_WINDOW = 10
const MIN_RECENT_MATCHES = 2

export type TeammatePref = "want" | "ok"

export type PreferenceCandidate = {
  id: string
  name: string
  photo_url: string | null
  pref: TeammatePref | null
}

type ServiceClient = NonNullable<ReturnType<typeof createServerClient>>

// Ids of players who can be picked, in no particular order.
async function getEligibleIds(supabase: ServiceClient): Promise<Set<string>> {
  const { data: matches, error: matchError } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(RECENT_MATCH_WINDOW)

  if (matchError || !matches?.length) {
    if (matchError) console.error("getEligibleIds matches:", matchError.message)
    return new Set()
  }

  const { data: rows, error: rowError } = await supabase
    .from("match_players")
    .select("user_id, users(phone)")
    .in(
      "match_id",
      matches.map((m) => m.id),
    )
    .eq("status", "active")

  if (rowError) {
    console.error("getEligibleIds match_players:", rowError.message)
    return new Set()
  }

  const appearances = new Map<string, number>()
  for (const row of (rows ?? []) as any[]) {
    if (isPlaceholderPhone(row.users?.phone)) continue
    appearances.set(row.user_id, (appearances.get(row.user_id) ?? 0) + 1)
  }

  return new Set([...appearances].filter(([, count]) => count >= MIN_RECENT_MATCHES).map(([id]) => id))
}

// The signed-in player's pickable list with their current choice for each.
// Also includes anyone they already rated who has since dropped out of the
// eligible set, so an old choice can still be changed. null when signed out.
export async function getMyTeammatePreferences(): Promise<PreferenceCandidate[] | null> {
  const supabase = createServerClient()
  const viewer = await getCurrentPlayer()
  if (!supabase || !viewer) return null

  const [eligible, { data: prefs, error: prefError }] = await Promise.all([
    getEligibleIds(supabase),
    supabase.from("teammate_preferences").select("target_id, pref").eq("voter_id", viewer.id),
  ])

  if (prefError) {
    console.error("getMyTeammatePreferences:", prefError.message)
    return []
  }

  const prefByTarget = new Map<string, TeammatePref>((prefs ?? []).map((p: any) => [p.target_id, p.pref]))
  const ids = new Set([...eligible, ...prefByTarget.keys()])
  ids.delete(viewer.id)
  if (ids.size === 0) return []

  const { data: users, error: userError } = await supabase
    .from("users")
    .select("id, name, photo_url")
    .in("id", [...ids])
    .order("name")

  if (userError) {
    console.error("getMyTeammatePreferences users:", userError.message)
    return []
  }

  return (users ?? []).map((u: any) => ({
    id: u.id,
    name: u.name,
    photo_url: u.photo_url ?? null,
    pref: prefByTarget.get(u.id) ?? null,
  }))
}

// For the toggle on someone else's profile. `canPick` is false when signed out,
// on your own profile, or when the target is not eligible (and not already rated).
export async function getMyPreferenceFor(
  targetId: string,
): Promise<{ canPick: boolean; pref: TeammatePref | null }> {
  const supabase = createServerClient()
  const viewer = await getCurrentPlayer()
  if (!supabase || !viewer || !targetId || viewer.id === targetId) return { canPick: false, pref: null }

  const { data } = await supabase
    .from("teammate_preferences")
    .select("pref")
    .eq("voter_id", viewer.id)
    .eq("target_id", targetId)
    .maybeSingle()

  const pref = (data?.pref as TeammatePref | undefined) ?? null
  if (pref) return { canPick: true, pref }

  const eligible = await getEligibleIds(supabase)
  return { canPick: eligible.has(targetId), pref: null }
}

// Set or clear (pref = null) the signed-in player's choice for one target.
export async function setTeammatePreference(
  targetId: string,
  pref: TeammatePref | null,
): Promise<{ ok: boolean }> {
  const supabase = createServerClient()
  const viewer = await getCurrentPlayer()
  if (!supabase || !viewer || !targetId || viewer.id === targetId) return { ok: false }
  if (pref !== null && pref !== "want" && pref !== "ok") return { ok: false }

  if (pref === null) {
    const { error } = await supabase
      .from("teammate_preferences")
      .delete()
      .eq("voter_id", viewer.id)
      .eq("target_id", targetId)
    if (error) console.error("setTeammatePreference delete:", error.message)
    return { ok: !error }
  }

  // Only eligible players can be newly picked; an existing row can always change.
  const { data: existing } = await supabase
    .from("teammate_preferences")
    .select("pref")
    .eq("voter_id", viewer.id)
    .eq("target_id", targetId)
    .maybeSingle()

  if (!existing) {
    const eligible = await getEligibleIds(supabase)
    if (!eligible.has(targetId)) return { ok: false }
  }

  const { error } = await supabase
    .from("teammate_preferences")
    .upsert({ voter_id: viewer.id, target_id: targetId, pref, updated_at: new Date().toISOString() })

  if (error) console.error("setTeammatePreference upsert:", error.message)
  return { ok: !error }
}

// How many players the signed-in player has rated; drives the post-login nudge.
export async function countMyTeammatePreferences(): Promise<number | null> {
  const supabase = createServerClient()
  const viewer = await getCurrentPlayer()
  if (!supabase || !viewer) return null

  const { count, error } = await supabase
    .from("teammate_preferences")
    .select("voter_id", { count: "exact", head: true })
    .eq("voter_id", viewer.id)

  if (error) {
    console.error("countMyTeammatePreferences:", error.message)
    return null
  }
  return count ?? 0
}
