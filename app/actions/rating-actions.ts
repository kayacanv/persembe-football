"use server"

// Crowd-voted player stats (migration add-stat-ratings.sql, plan-ratings.md).
//
// A signed-in player rates teammates on all 8 stats at once. Who can be rated:
// players with a real phone who played in at least one of the last
// RECENT_MATCH_WINDOW finished matches and shared a match with the voter in the
// last SHARED_WINDOW_DAYS. The queue puts the players you played with most first.
//
// Votes are private: every read and write here is scoped to the session's own
// player, and nothing ever returns another voter's values.

import { createServerClient } from "../lib/supabase"
import { getCurrentPlayer } from "../lib/supabase-ssr"
import { isPlaceholderPhone } from "../lib/phone"
import { computePlayerRating } from "../lib/rating"
import {
  RATING_STATS,
  isCompleteRating,
  isRatingStat,
  isRatingValue,
  type MyRating,
  type StatValues,
} from "../lib/rating-stats"

const RECENT_MATCH_WINDOW = 10
const SHARED_WINDOW_DAYS = 365
const PAGE = 1000

export type QueueStatus = "todo" | "skipped" | "rated"

export type QueuePlayer = {
  id: string
  name: string
  photo_url: string | null
  card_position: string | null
  shared: number // matches played together in the last SHARED_WINDOW_DAYS
  status: QueueStatus
  values: StatValues | null
}

export type RatingQueue = { queue: QueuePlayer[]; mine: MyRating[] }

type ServiceClient = NonNullable<ReturnType<typeof createServerClient>>

// PostgREST caps a response at 1000 rows; page through anything that can grow.
async function fetchAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>) {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

// Rateable players for this voter → matches played together recently.
async function getRateable(supabase: ServiceClient, voterId: string): Promise<Map<string, number>> {
  const since = new Date(Date.now() - SHARED_WINDOW_DAYS * 86_400_000).toISOString()

  const [{ data: recent }, { data: mine }] = await Promise.all([
    supabase
      .from("matches")
      .select("id")
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(RECENT_MATCH_WINDOW),
    supabase
      .from("match_players")
      .select("match_id, matches!inner(created_at)")
      .eq("user_id", voterId)
      .eq("status", "active")
      .gte("matches.created_at", since),
  ])

  const recentIds = (recent ?? []).map((m) => m.id)
  const myMatchIds = (mine ?? []).map((r: any) => r.match_id)
  if (recentIds.length === 0 || myMatchIds.length === 0) return new Map()

  const [recentRows, sharedRows] = await Promise.all([
    fetchAll<any>((from, to) =>
      supabase
        .from("match_players")
        .select("user_id, users(phone)")
        .in("match_id", recentIds)
        .eq("status", "active")
        .range(from, to),
    ),
    fetchAll<any>((from, to) =>
      supabase
        .from("match_players")
        .select("user_id")
        .in("match_id", myMatchIds)
        .eq("status", "active")
        .range(from, to),
    ),
  ])

  const recentPlayers = new Set(
    recentRows.filter((r) => !isPlaceholderPhone(r.users?.phone)).map((r) => r.user_id as string),
  )

  const shared = new Map<string, number>()
  for (const r of sharedRows) {
    if (r.user_id === voterId || !recentPlayers.has(r.user_id)) continue
    shared.set(r.user_id, (shared.get(r.user_id) ?? 0) + 1)
  }
  return shared
}

// Every rating this voter has given, grouped per target.
async function getMyValues(supabase: ServiceClient, voterId: string) {
  const rows = await fetchAll<any>((from, to) =>
    supabase
      .from("stat_ratings")
      .select("target_id, stat, value, users!stat_ratings_target_id_fkey(name)")
      .eq("voter_id", voterId)
      .range(from, to),
  )

  const byTarget = new Map<string, Partial<StatValues>>()
  const mine: MyRating[] = []
  for (const r of rows) {
    const stat: unknown = r.stat
    const value: unknown = r.value
    if (!isRatingStat(stat) || !isRatingValue(value)) continue
    const values = byTarget.get(r.target_id) ?? {}
    values[stat] = value
    byTarget.set(r.target_id, values)
    mine.push({ targetId: r.target_id, name: r.users?.name ?? "", stat, value })
  }
  return { byTarget, mine }
}

// The voting page's data: the ordered queue plus the voter's own earlier votes
// (for the reminders). null when signed out.
export async function getRatingQueue(): Promise<RatingQueue | null> {
  const supabase = createServerClient()
  const viewer = await getCurrentPlayer()
  if (!supabase || !viewer) return null

  try {
    const [shared, { byTarget, mine }, { data: skips }] = await Promise.all([
      getRateable(supabase, viewer.id),
      getMyValues(supabase, viewer.id),
      supabase.from("stat_rating_skips").select("target_id, skipped_at").eq("voter_id", viewer.id),
    ])
    if (shared.size === 0) return { queue: [], mine }

    const skippedAt = new Map<string, string>((skips ?? []).map((s: any) => [s.target_id, s.skipped_at]))

    const { data: users, error } = await supabase
      .from("users")
      .select("id, name, photo_url, card_position")
      .in("id", [...shared.keys()])
    if (error) throw new Error(error.message)

    const rank: Record<QueueStatus, number> = { todo: 0, skipped: 1, rated: 2 }
    const queue: QueuePlayer[] = (users ?? []).map((u: any) => {
      const values = byTarget.get(u.id)
      const complete = isCompleteRating(values)
      return {
        id: u.id,
        name: u.name,
        photo_url: u.photo_url ?? null,
        card_position: u.card_position ?? null,
        shared: shared.get(u.id) ?? 0,
        status: complete ? "rated" : skippedAt.has(u.id) ? "skipped" : "todo",
        values: complete ? values : null,
      }
    })

    queue.sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        (a.status === "skipped" ? (skippedAt.get(a.id)! < skippedAt.get(b.id)! ? -1 : 1) : 0) ||
        b.shared - a.shared ||
        a.name.localeCompare(b.name, "tr"),
    )

    return { queue, mine }
  } catch (error) {
    console.error("getRatingQueue:", error)
    return { queue: [], mine: [] }
  }
}

// How many rateable players the signed-in player has not rated yet (banner/nudge).
export async function countPendingRatings(): Promise<number> {
  const supabase = createServerClient()
  const viewer = await getCurrentPlayer()
  if (!supabase || !viewer) return 0

  try {
    const [shared, { byTarget }] = await Promise.all([
      getRateable(supabase, viewer.id),
      getMyValues(supabase, viewer.id),
    ])
    return [...shared.keys()].filter((id) => !isCompleteRating(byTarget.get(id))).length
  } catch (error) {
    console.error("countPendingRatings:", error)
    return 0
  }
}

// For the "Oylarım" tab on someone else's profile. `canRate` when the target is
// rateable for the viewer, or already rated by them (an old rating stays editable).
export async function getMyRatingFor(
  targetId: string,
): Promise<{ canRate: boolean; values: StatValues | null; mine: MyRating[] }> {
  const empty = { canRate: false, values: null, mine: [] }
  const supabase = createServerClient()
  const viewer = await getCurrentPlayer()
  if (!supabase || !viewer || !targetId || viewer.id === targetId) return empty

  try {
    const [shared, { byTarget, mine }] = await Promise.all([
      getRateable(supabase, viewer.id),
      getMyValues(supabase, viewer.id),
    ])
    const values = byTarget.get(targetId)
    const complete = isCompleteRating(values)
    return { canRate: complete || shared.has(targetId), values: complete ? values : null, mine }
  } catch (error) {
    console.error("getMyRatingFor:", error)
    return empty
  }
}

// Save all 8 stats for one target. Partial ratings are rejected.
export async function saveRating(targetId: string, values: StatValues): Promise<{ ok: boolean }> {
  const supabase = createServerClient()
  const viewer = await getCurrentPlayer()
  if (!supabase || !viewer || !targetId || viewer.id === targetId) return { ok: false }
  if (!isCompleteRating(values)) return { ok: false }

  try {
    const { count } = await supabase
      .from("stat_ratings")
      .select("stat", { count: "exact", head: true })
      .eq("voter_id", viewer.id)
      .eq("target_id", targetId)

    if (!count) {
      const shared = await getRateable(supabase, viewer.id)
      if (!shared.has(targetId)) return { ok: false }
    }

    const now = new Date().toISOString()
    const { error } = await supabase.from("stat_ratings").upsert(
      RATING_STATS.map((stat) => ({
        voter_id: viewer.id,
        target_id: targetId,
        stat,
        value: values[stat],
        updated_at: now,
      })),
    )
    if (error) throw new Error(error.message)

    await supabase.from("stat_rating_skips").delete().eq("voter_id", viewer.id).eq("target_id", targetId)
    await recomputePlayerRating(supabase, targetId)
    return { ok: true }
  } catch (error) {
    console.error("saveRating:", error)
    return { ok: false }
  }
}

// Rebuild one player's public player_ratings row from all votes for them.
// A failure here never fails the vote itself; the next vote recomputes again.
async function recomputePlayerRating(supabase: ServiceClient, targetId: string) {
  try {
    const votes = await fetchAll<any>((from, to) =>
      supabase.from("stat_ratings").select("voter_id, stat, value").eq("target_id", targetId).range(from, to),
    )
    const rating = computePlayerRating(votes.filter((v) => isRatingStat(v.stat) && isRatingValue(v.value)))
    const { error } = await supabase
      .from("player_ratings")
      .upsert({ user_id: targetId, ...rating, updated_at: new Date().toISOString() })
    if (error) throw new Error(error.message)
  } catch (error) {
    console.error("recomputePlayerRating:", error)
  }
}

// "Skip this player": moves them behind the unrated players in the queue.
export async function skipRating(targetId: string): Promise<{ ok: boolean }> {
  const supabase = createServerClient()
  const viewer = await getCurrentPlayer()
  if (!supabase || !viewer || !targetId || viewer.id === targetId) return { ok: false }

  const { error } = await supabase
    .from("stat_rating_skips")
    .upsert({ voter_id: viewer.id, target_id: targetId, skipped_at: new Date().toISOString() })
  if (error) console.error("skipRating:", error.message)
  return { ok: !error }
}
