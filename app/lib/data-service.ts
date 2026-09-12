import { getSupabaseBrowserClient } from "./supabase"
import { MAX_ACTIVE_PLAYERS } from "./constants"
import { unlinkBankPaymentsForMatchPlayer } from "../actions/starling-actions"
import type { Match, MatchStatus, Position, PlayerWithDetails, Team, PlayerStatus, PlayerRankingStats } from "./types"
import type { User } from "./types"

// Get all matches
export async function getMatches(): Promise<Match[]> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return []
  }

  const { data, error } = await supabase.from("matches").select("*").order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching matches:", error)
    return []
  }

  return data || []
}

// Get a specific match by ID
export async function getMatchById(id: string): Promise<Match | null> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return null
  }

  const { data, error } = await supabase.from("matches").select("*").eq("id", id).single()

  if (error) {
    console.error("Error fetching match:", error)
    return null
  }

  return data
}

// Get a specific match by its date (DD.MM.YYYY). Returns the most recent if several share a date.
export async function getMatchByDate(date: string): Promise<Match | null> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return null
  }

  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("date", date)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      // No match found for this date
      return null
    }
    console.error("Error fetching match by date:", error)
    return null
  }

  return data
}

// Get players for a specific match
export async function getPlayersForMatch(matchId: string): Promise<PlayerWithDetails[]> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return []
  }

  const { data, error } = await supabase
    .from("match_players")
    .select(`
      id,
      match_id,
      user_id,
      has_paid,
      team,
      status,
      position,
      field_x,
      field_y,
      registration_date,
      users (
        id,
        name,
        phone,
        position,
        confirmed,
        power,
        position_weight,
        photo_url,
        jersey_number,
        card_overall,
        card_pac,
        card_sho,
        card_pas,
        card_dri,
        card_def,
        card_phy,
        card_position,
        card_nation,
        club_badge_url,
        card_tier,
        card_photo_scale,
        card_photo_x,
        card_photo_y,
        card_photo_fade,
        card_baked
      )
    `)
    .eq("match_id", matchId)
    .order("registration_date", { ascending: true })

  if (error) {
    console.error("Error fetching players for match:", error)
    return []
  }

  // Transform the data to match our UI expectations
  const players = data.map((item) => ({
    id: item.users.id,
    name: item.users.name,
    phone: item.users.phone,
    position: item.users.position as Position, // This is the user's preferred position (string)
    confirmed: item.users.confirmed,
    power: item.users.power || 5, // Default to 5 if power is null
    position_weight: item.users.position_weight || 3, // Default to 3 if position_weight is null
    photo_url: item.users.photo_url, // Added photo_url
    jersey_number: item.users.jersey_number ?? undefined,
    // FIFA card fields (?? keeps cards rendering even if a column is missing/null)
    card_overall: item.users.card_overall ?? undefined,
    card_pac: item.users.card_pac ?? undefined,
    card_sho: item.users.card_sho ?? undefined,
    card_pas: item.users.card_pas ?? undefined,
    card_dri: item.users.card_dri ?? undefined,
    card_def: item.users.card_def ?? undefined,
    card_phy: item.users.card_phy ?? undefined,
    card_position: item.users.card_position ?? undefined,
    card_nation: item.users.card_nation ?? undefined,
    club_badge_url: item.users.club_badge_url ?? undefined,
    card_tier: item.users.card_tier ?? undefined,
    card_photo_scale: item.users.card_photo_scale ?? undefined,
    card_photo_x: item.users.card_photo_x ?? undefined,
    card_photo_y: item.users.card_photo_y ?? undefined,
    card_photo_fade: item.users.card_photo_fade ?? undefined,
    card_baked: item.users.card_baked ?? undefined,
    has_paid: item.has_paid,
    team: item.team as Team,
    match_player_id: item.id,
    status: item.status as PlayerStatus,
    field_position: item.position, // This is the field position number (1-8)
    field_x: item.field_x ?? null, // exact pitch x % (source of truth for layout)
    field_y: item.field_y ?? null, // exact pitch y %
    registration_date: item.registration_date,
  }))

  // Calculate waitlist positions for waitlisted players
  const activeCount = players.filter((p) => p.status === "active").length
  const waitlistedPlayers = players.filter((p) => p.status === "waitlist")

  waitlistedPlayers.forEach((player, index) => {
    player.waitlist_position = index + 1
  })

  // Sort players: active first, then waitlisted
  return [...players.filter((p) => p.status === "active"), ...waitlistedPlayers]
}

// Create a new match
export async function createMatch(
  match: Omit<Match, "id" | "created_at" | "price"> & { price?: number },
): Promise<Match | null> {
  const supabase = getSupabaseBrowserClient()
  const matchData = {
    ...match,
    price: match.price ?? 10, // Default price if not provided
  }
  const { data, error } = await supabase.from("matches").insert(matchData).select().single()

  if (error) {
    console.error("Error creating match:", error)
    return null
  }

  return data
}

// Update match status
export async function updateMatchStatus(matchId: string, status: MatchStatus): Promise<boolean> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.from("matches").update({ status }).eq("id", matchId)

  if (error) {
    console.error("Error updating match status:", error)
    return false
  }

  return true
}

// Update match score
export async function updateMatchScore(matchId: string, scoreA: number, scoreB: number): Promise<boolean> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.from("matches").update({ score_a: scoreA, score_b: scoreB }).eq("id", matchId)

  if (error) {
    console.error("Error updating match score:", error)
    return false
  }

  return true
}

// Update the registerPlayerForMatch function to handle phone NOT NULL constraint
export async function registerPlayerForMatch(
  matchId: string,
  name: string,
  phone: string | null,
  position: Position,
  email?: string, // Keep this parameter for future use, but don't use it in the database
): Promise<boolean> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return false
  }

  let userId: string

  // Generate a placeholder phone number if none is provided
  // Format: "no-phone-{timestamp}" to ensure uniqueness
  const actualPhone = phone || `no-phone-${Date.now()}`

  // Check if the user already exists with this phone number
  const { data: existingUser, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("phone", actualPhone)
    .single()

  if (!userError && existingUser) {
    userId = existingUser.id

    // Update user information (without email)
    await supabase.from("users").update({ name, position }).eq("id", userId)
  } else {
    // User doesn't exist, create a new one (without email, with default power of 5 and position_weight of 3)
    const { data: newUser, error: createError } = await supabase
      .from("users")
      .insert({ name, phone: actualPhone, position, power: 5, position_weight: 3 })
      .select("id")
      .single()

    if (createError) {
      console.error("Error creating user:", createError)
      return false
    }

    userId = newUser.id
  }

  // Check if the player is already registered for this match
  const { data: existingRegistration, error: registrationError } = await supabase
    .from("match_players")
    .select("id")
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .single()

  if (!registrationError && existingRegistration) {
    // Leaving is a hard delete, so an existing row always means "already registered".
    return true
  }

  // Count active players to determine if the player should be waitlisted
  const { count, error: countError } = await supabase
    .from("match_players")
    .select("id", { count: "exact" })
    .eq("match_id", matchId)
    .eq("status", "active")

  if (countError) {
    console.error("Error counting active players:", countError)
    return false
  }

  const status = count !== null && count >= MAX_ACTIVE_PLAYERS ? "waitlist" : "active"

  // Now register the player for the match
  const { error: registerError } = await supabase.from("match_players").insert({
    match_id: matchId,
    user_id: userId,
    has_paid: false,
    status,
    position: 0, // Default position value (0 means unassigned)
    registration_date: new Date().toISOString(),
  })

  if (registerError) {
    console.error("Error registering player for match:", registerError)
    return false
  }

  return true
}

export type LeaveResult = "removed" | "blocked_paid" | "error"

// Take a player off a match. Leaving is a hard delete: the match_players row is
// removed and a later sign-up creates a fresh row. A player marked as paid is
// refused — the payment has to be un-marked first so the bank reconciliation
// trail stays intact. If the leaver held a playing slot, the oldest reserve is
// promoted into it.
export async function removePlayerFromMatch(matchPlayerId: string): Promise<LeaveResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return "error"
  }

  const { data: row, error: fetchError } = await supabase
    .from("match_players")
    .select("status, has_paid, match_id")
    .eq("id", matchPlayerId)
    .single()

  if (fetchError || !row) {
    console.error("Error fetching match player:", fetchError)
    return "error"
  }

  if (row.has_paid) return "blocked_paid"

  // Belt-and-braces: has_paid blocks the real case, but never let the FK's
  // ON DELETE SET NULL leave a "matched" bank payment with no player behind it.
  const unlink = await unlinkBankPaymentsForMatchPlayer(matchPlayerId)
  if (!unlink.success) {
    console.error("Error unlinking bank payments:", unlink.error)
    return "error"
  }

  const { error: deleteError } = await supabase.from("match_players").delete().eq("id", matchPlayerId)

  if (deleteError) {
    console.error("Error removing player from match:", deleteError)
    return "error"
  }

  // Only an active departure frees a playing slot to promote into.
  if (row.status === "active") {
    const { data: waitlistedPlayers, error: waitlistError } = await supabase
      .from("match_players")
      .select("id")
      .eq("match_id", row.match_id)
      .eq("status", "waitlist")
      .order("registration_date", { ascending: true })
      .limit(1)

    if (waitlistError) {
      console.error("Error fetching waitlisted players:", waitlistError)
    } else if (waitlistedPlayers && waitlistedPlayers.length > 0) {
      const { error: promoteError } = await supabase
        .from("match_players")
        .update({ status: "active" })
        .eq("id", waitlistedPlayers[0].id)

      if (promoteError) {
        console.error("Error promoting waitlisted player:", promoteError)
      }
    }
  }

  return "removed"
}

// Update player payment status
export async function updatePlayerPaymentStatus(matchPlayerId: string, hasPaid: boolean): Promise<boolean> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return false
  }
  const { error } = await supabase.from("match_players").update({ has_paid: hasPaid }).eq("id", matchPlayerId)

  if (error) {
    console.error("Error updating payment status:", error)
    return false
  }

  return true
}

// Update player team assignment
export async function updatePlayerTeam(matchPlayerId: string, team: Team): Promise<boolean> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return false
  }
  const { error } = await supabase.from("match_players").update({ team }).eq("id", matchPlayerId)

  if (error) {
    console.error("Error updating player team:", error)
    return false
  }

  return true
}

// Helper function to get the next Thursday date
export function getNextThursday(): string {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 is Sunday, 4 is Thursday
  const daysUntilThursday = (4 + 7 - dayOfWeek) % 7
  const nextThursday = new Date(today)
  nextThursday.setDate(today.getDate() + daysUntilThursday)

  // Format date as DD.MM.YYYY
  return `${nextThursday.getDate().toString().padStart(2, "0")}.${(nextThursday.getMonth() + 1).toString().padStart(2, "0")}.${nextThursday.getFullYear()}`
}

// Create a new match for the next Thursday
export async function createNextThursdayMatch(price = 10): Promise<Match | null> {
  const date = getNextThursday()
  const time = "21:00"

  return createMatch({
    date,
    time,
    status: "registering",
    price, // Use the provided price
  })
}

// Get the active match: the one still registering (the cron flips it to done at kickoff)
export async function getActiveMatch(): Promise<Match | null> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return null
  }
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "registering")
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      // No active match found
      return null
    }
    console.error("Error fetching active match:", error)
    return null
  }

  return data
}

// Get past matches (done)
export async function getPastMatches(limit = 10): Promise<Match[]> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return []
  }
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Error fetching past matches:", error)
    return []
  }

  return data || []
}

// Add a function to confirm a user
export async function confirmUser(userId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return false
  }
  const { error } = await supabase.from("users").update({ confirmed: true }).eq("id", userId)

  if (error) {
    console.error("Error confirming user:", error)
    return false
  }

  return true
}

// Check if a user exists by phone number
export async function getUserByPhone(phone: string) {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return null
  }
  const { data, error } = await supabase.from("users").select("*").eq("phone", phone).single()

  if (error) {
    if (error.code === "PGRST116") {
      // No user found with this phone number
      return null
    }
    console.error("Error fetching user by phone:", error)
    return null
  }

  return data
}

// Get all distinct users
export async function getAllUsers(): Promise<User[]> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return []
  }

  const { data, error } = await supabase.from("users").select("*").order("name")

  if (error) {
    console.error("Error fetching users:", error)
    return []
  }

  return data || []
}

// Lightweight {id, name} list for the "link phone to existing player" picker.
// Selects no phone/email on purpose — numbers must never reach the client UI.
export async function getUserNames(): Promise<Array<{ id: string; name: string }>> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return []
  }

  const { data, error } = await supabase.from("users").select("id, name").order("name")

  if (error) {
    console.error("Error fetching user names:", error)
    return []
  }

  return data || []
}

// Phone writes used to live here, on the anon-key browser client. They now run
// as server actions (updatePhone / createPlayerWithPhone in
// app/actions/auth-actions.ts) so that a number can also be kept in step with the
// player's Supabase Auth user, and so the anon key never writes one.

// Get active player count for a match
export async function getActivePlayerCount(matchId: string): Promise<number> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return 0
  }
  const { count, error } = await supabase
    .from("match_players")
    .select("id", { count: "exact" })
    .eq("match_id", matchId)
    .eq("status", "active")

  if (error) {
    console.error("Error counting active players:", error)
    return 0
  }

  return count || 0
}

export async function getUnpaidPlayerCount(matchId: string): Promise<number> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return 0
  }
  const { count, error } = await supabase
    .from("match_players")
    .select("id", { count: "exact" })
    .eq("match_id", matchId)
    .eq("status", "active")
    .eq("has_paid", false)

  if (error) {
    console.error("Error counting unpaid players:", error)
    return 0
  }

  return count || 0
}

// Update the balanceTeamsByPower function to consider already assigned players
export function balanceTeamsByPower(
  unassignedPlayers: PlayerWithDetails[],
  existingTeamA: PlayerWithDetails[] = [],
  existingTeamB: PlayerWithDetails[] = [],
): {
  teamA: PlayerWithDetails[]
  teamB: PlayerWithDetails[]
} {
  // Sort unassigned players by power in descending order (best players first)
  const sortedPlayers = [...unassignedPlayers].sort((a, b) => (b.power || 5) - (a.power || 5))

  // Calculate existing team powers
  const teamAPower = existingTeamA.reduce((sum, p) => sum + (p.power || 5), 0)
  const teamBPower = existingTeamB.reduce((sum, p) => sum + (p.power || 5), 0)

  // Calculate existing team sizes
  const teamASize = existingTeamA.length
  const teamBSize = existingTeamB.length

  // Initialize result arrays with existing players
  let teamA: PlayerWithDetails[] = [...existingTeamA]
  let teamB: PlayerWithDetails[] = [...existingTeamB]

  // Distribute unassigned players using a greedy algorithm to balance power
  for (const player of sortedPlayers) {
    // Calculate current team powers
    const currentTeamAPower = teamA.reduce((sum, p) => sum + (p.power || 5), 0)
    const currentTeamBPower = teamB.reduce((sum, p) => sum + (p.power || 5), 0)

    // Add player to the team with lower total power or fewer players if powers are equal
    if (
      (currentTeamAPower < currentTeamBPower ||
        (currentTeamAPower === currentTeamBPower && teamA.length < teamB.length)) &&
      teamA.length < 8
    ) {
      teamA.push(player)
    } else if (teamB.length < 8) {
      teamB.push(player)
    } else {
      // If one team is full, add to the other
      teamA.push(player)
    }
  }

  function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }

  // Only shuffle the newly added players, not the existing ones
  if (teamA.length > teamASize) {
    const existingA = teamA.slice(0, teamASize)
    const newA = shuffleArray(teamA.slice(teamASize))
    teamA = [...existingA, ...newA]
  }

  if (teamB.length > teamBSize) {
    const existingB = teamB.slice(0, teamBSize)
    const newB = shuffleArray(teamB.slice(teamBSize))
    teamB = [...existingB, ...newB]
  }

  return { teamA, teamB }
}

// Get all player statistics for ranking
export async function getAllPlayerStats(minMatches = 2): Promise<PlayerRankingStats[]> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return []
  }

  const { data: allMatchPlayers, error } = await supabase
    .from("match_players")
    .select(
      `
      user_id,
      team,
      users (id, name),
      matches (id, status, score_a, score_b)
    `,
    )
    .eq("status", "active") // Only active participations
    .eq("matches.status", "done") // Only completed matches

  if (error) {
    console.error("Error fetching all player match data for stats:", error)
    return []
  }

  const playerStatsMap = new Map<
    string,
    { name: string; totalMatches: number; wins: number; draws: number; losses: number }
  >()

  allMatchPlayers.forEach((mp) => {
    // Ensure mp, mp.users, and mp.matches are not null and scores are numbers
    if (
      !mp ||
      !mp.users ||
      !mp.matches ||
      typeof mp.matches.score_a !== "number" ||
      typeof mp.matches.score_b !== "number"
    ) {
      return // Skip if essential data is missing or scores are not numbers
    }

    const userId = mp.users.id
    const name = mp.users.name

    let stats = playerStatsMap.get(userId)
    if (!stats) {
      stats = { name, totalMatches: 0, wins: 0, draws: 0, losses: 0 }
    }

    stats.totalMatches += 1

    if (mp.matches.score_a === mp.matches.score_b && mp.matches.score_a !== 0) {
      stats.draws += 1
    } else if (mp.team === "A" && mp.matches.score_a > mp.matches.score_b) {
      stats.wins += 1
    } else if (mp.team === "B" && mp.matches.score_b > mp.matches.score_a) {
      stats.wins += 1
    } else {
      stats.losses += 1
    }

    playerStatsMap.set(userId, stats)
  })

  const rankedPlayers: PlayerRankingStats[] = []
  playerStatsMap.forEach((stats, userId) => {
    if (stats.totalMatches >= minMatches) {
      rankedPlayers.push({
        userId,
        name: stats.name,
        totalMatches: stats.totalMatches,
        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,
        winRate: stats.totalMatches > 0 ? Math.round((stats.wins / stats.totalMatches) * 100) : 0,
      })
    }
  })

  // Sort by win rate (descending), then by total matches (descending) as a tie-breaker
  return rankedPlayers.sort((a, b) => {
    if (b.winRate !== a.winRate) {
      return b.winRate - a.winRate
    }
    return b.totalMatches - a.totalMatches
  })
}
