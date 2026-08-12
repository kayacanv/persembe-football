import { getSupabaseBrowserClient } from "./supabase"
import { getPlayersForMatch } from "./data-service"
import type { Match, MvpVoteCount, MvpWinner, VotingWindow } from "./types"
import { parse } from "date-fns"

// We play Thursday 21:00–22:00. Voting opens at the final whistle (22:00) and
// closes the following Tuesday at the same wall-clock time (21:00).
const PLAY_DURATION_MS = 60 * 60 * 1000 // 1h: 21:00 -> 22:00 (opens)
const VOTING_CLOSE_DAY = 2 // 0=Sun … 2=Tue: voting closes on Tuesday

// First occurrence of `targetDay` strictly after `from`, preserving the local
// wall-clock time. Using setDate (not raw ms) keeps 21:00 as 21:00 across DST.
function nextWeekdayAtSameTime(from: Date, targetDay: number): Date {
  const result = new Date(from)
  const days = (targetDay - from.getDay() + 7) % 7 || 7
  result.setDate(result.getDate() + days)
  return result
}

const DEVICE_ID_KEY = "halisaha_device_id"
const votedKey = (matchId: string) => `mvp_voted_${matchId}`

// Stable per-browser id, created on first use. localStorage is only the UX guard;
// the DB unique(match_id, device_id) constraint is the real one.
export function getDeviceId(): string {
  if (typeof window === "undefined") return ""
  let id = window.localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

// Single source of truth for when a match's MVP vote is open/closed.
export function getVotingWindow(match: Pick<Match, "date" | "time">): VotingWindow {
  const start = parse(`${match.date} ${match.time}`, "dd.MM.yyyy HH:mm", new Date())
  const openAt = new Date(start.getTime() + PLAY_DURATION_MS)
  const closeAt = nextWeekdayAtSameTime(start, VOTING_CLOSE_DAY)
  const now = new Date()
  return {
    openAt,
    closeAt,
    isOpen: now >= openAt && now < closeAt,
    isClosed: now >= closeAt,
  }
}

// The players who actually played (active roster), in registration order.
export async function getMvpCandidates(matchId: string): Promise<MvpVoteCount[]> {
  const players = await getPlayersForMatch(matchId)
  return players
    .filter((p) => p.status === "active")
    .map((p) => ({
      candidateId: p.id,
      name: p.name,
      photo_url: p.photo_url,
      votes: 0,
    }))
}

export function hasVotedLocally(matchId: string): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(votedKey(matchId)) !== null
}

// Has this device already voted in this match (server-side check)?
export async function getMyVote(matchId: string): Promise<string | null> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return null
  const deviceId = getDeviceId()
  if (!deviceId) return null

  const { data } = await supabase
    .from("mvp_votes")
    .select("candidate_id")
    .eq("match_id", matchId)
    .eq("device_id", deviceId)
    .maybeSingle()

  return data?.candidate_id ?? null
}

// Cast a vote. Returns true on success or if this device had already voted.
export async function castVote(matchId: string, candidateId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return false
  const deviceId = getDeviceId()
  if (!deviceId) return false

  const { error } = await supabase.from("mvp_votes").insert({
    match_id: matchId,
    candidate_id: candidateId,
    device_id: deviceId,
  })

  // 23505 = unique_violation -> this device already voted; treat as success.
  if (error && error.code !== "23505") {
    console.error("Error casting MVP vote:", error)
    return false
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(votedKey(matchId), candidateId)
  }
  return true
}

// Live tally for a single match, joined to candidate names/photos and sorted desc.
// Tie-break: earliest registration (candidate order from getMvpCandidates).
export async function getVoteCounts(matchId: string): Promise<MvpVoteCount[]> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return []

  const [candidates, votesRes] = await Promise.all([
    getMvpCandidates(matchId),
    supabase.from("mvp_votes").select("candidate_id").eq("match_id", matchId),
  ])

  const tally = new Map<string, number>()
  for (const row of votesRes.data ?? []) {
    tally.set(row.candidate_id, (tally.get(row.candidate_id) ?? 0) + 1)
  }

  // Preserve registration order for stable tie-breaking, then sort by votes desc.
  return candidates
    .map((c) => ({ ...c, votes: tally.get(c.candidateId) ?? 0 }))
    .sort((a, b) => b.votes - a.votes)
}

// Winner of a single match, or null if no votes were cast.
export async function getMvpWinner(matchId: string): Promise<MvpWinner | null> {
  const counts = await getVoteCounts(matchId)
  const top = counts[0]
  if (!top || top.votes === 0) return null
  return top
}

// Winners for many matches at once (home page badges). One query, tally in JS.
// Tie-break: earliest-registered candidate, matching getVoteCounts.
export async function getMvpWinnersForMatches(
  matchIds: string[],
): Promise<Map<string, MvpWinner>> {
  const result = new Map<string, MvpWinner>()
  const supabase = getSupabaseBrowserClient()
  if (!supabase || matchIds.length === 0) return result

  // Tally votes per (match, candidate) in one query.
  const { data: votes } = await supabase
    .from("mvp_votes")
    .select("match_id, candidate_id")
    .in("match_id", matchIds)

  if (!votes?.length) return result

  const matchTallies = new Map<string, Map<string, number>>()
  for (const v of votes) {
    if (!matchTallies.has(v.match_id)) matchTallies.set(v.match_id, new Map())
    const t = matchTallies.get(v.match_id)!
    t.set(v.candidate_id, (t.get(v.candidate_id) ?? 0) + 1)
  }

  // Resolve candidate details (registration order = tie-break) per match.
  await Promise.all(
    Array.from(matchTallies.keys()).map(async (matchId) => {
      const tally = matchTallies.get(matchId)!
      const candidates = await getMvpCandidates(matchId)
      let best: MvpWinner | null = null
      for (const c of candidates) {
        const votes = tally.get(c.candidateId) ?? 0
        if (votes > 0 && (!best || votes > best.votes)) {
          best = { ...c, votes }
        }
      }
      if (best) result.set(matchId, best)
    }),
  )

  return result
}

// Total times a player has been voted MVP across closed matches they played.
export async function getPlayerMvpCount(userId: string): Promise<number> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return 0

  // Matches this user played (active). Only count matches whose voting has closed,
  // so the awards tally reflects final results, not a provisional leader.
  const { data: played } = await supabase
    .from("match_players")
    .select("match_id, matches (date, time)")
    .eq("user_id", userId)
    .eq("status", "active")

  const matchIds = (played ?? [])
    .filter((p: any) => p.matches && getVotingWindow(p.matches).isClosed)
    .map((p: any) => p.match_id)
  if (matchIds.length === 0) return 0

  const winners = await getMvpWinnersForMatches(matchIds)
  let count = 0
  for (const winner of winners.values()) {
    if (winner.candidateId === userId) count++
  }
  return count
}
