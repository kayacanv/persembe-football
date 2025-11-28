import { getSupabaseBrowserClient } from "./supabase"
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
      registration_date,
      cancellation_date,
      users (
        id,
        name,
        phone,
        position,
        confirmed,
        power,
        position_weight,
        photo_url
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
    has_paid: item.has_paid,
    team: item.team as Team,
    match_player_id: item.id,
    status: item.status as PlayerStatus,
    field_position: item.position, // This is the field position number (1-8)
    registration_date: item.registration_date,
    cancellation_date: item.cancellation_date,
  }))

  // Calculate waitlist positions for waitlisted players
  const activeCount = players.filter((p) => p.status === "active").length
  const waitlistedPlayers = players.filter((p) => p.status === "waitlist")

  waitlistedPlayers.forEach((player, index) => {
    player.waitlist_position = index + 1
  })

  // Sort players: active first, then waitlisted, then canceled
  return [
    ...players.filter((p) => p.status === "active"),
    ...waitlistedPlayers,
    ...players.filter((p) => p.status === "canceled"),
  ]
}

// Create a new match
export async function createMatch(
  match: Omit<Match, "id" | "created_at" | "price"> & { price?: number },
): Promise<Match | null> {
  const supabase = getSupabaseBrowserClient()
  const matchData = {
    ...match,
    price: match.price ?? 7.5, // Default price if not provided
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
    .select("id, status")
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .single()

  if (!registrationError && existingRegistration) {
    // Player is already registered, check if they're canceled
    if (existingRegistration.status === "canceled") {
      // Reactivate the player
      const { error: updateError } = await supabase
        .from("match_players")
        .update({
          status: "active",
          cancellation_date: null,
          registration_date: new Date().toISOString(),
        })
        .eq("id", existingRegistration.id)

      if (updateError) {
        console.error("Error reactivating player:", updateError)
        return false
      }
      return true
    }
    return true // Player already registered and active, consider it a success
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

  const status = count !== null && count >= 18 ? "waitlist" : "active"

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

// Cancel player registration
export async function cancelPlayerRegistration(matchPlayerId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return false
  }

  // Update the player's status to canceled
  const { error: updateError } = await supabase
    .from("match_players")
    .update({
      status: "canceled",
      cancellation_date: new Date().toISOString(),
    })
    .eq("id", matchPlayerId)

  if (updateError) {
    console.error("Error canceling registration:", updateError)
    return false
  }

  // Get the match ID to promote waitlisted players
  const { data: matchPlayer, error: fetchError } = await supabase
    .from("match_players")
    .select("match_id")
    .eq("id", matchPlayerId)
    .single()

  if (fetchError) {
    console.error("Error fetching match player:", fetchError)
    return true // Still return true as the cancellation was successful
  }

  // Check if there are any waitlisted players to promote
  const { data: waitlistedPlayers, error: waitlistError } = await supabase
    .from("match_players")
    .select("id")
    .eq("match_id", matchPlayer.match_id)
    .eq("status", "waitlist")
    .order("registration_date", { ascending: true })
    .limit(1)

  if (waitlistError) {
    console.error("Error fetching waitlisted players:", waitlistError)
    return true // Still return true as the cancellation was successful
  }

  // If there's a waitlisted player, promote them to active
  if (waitlistedPlayers && waitlistedPlayers.length > 0) {
    const { error: promoteError } = await supabase
      .from("match_players")
      .update({ status: "active" })
      .eq("id", waitlistedPlayers[0].id)

    if (promoteError) {
      console.error("Error promoting waitlisted player:", promoteError)
    }
  }

  return true
}

// Remove a player from a match
export async function removePlayerFromMatch(matchId: string, userId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return false
  }
  const { error } = await supabase.from("match_players").delete().eq("match_id", matchId).eq("user_id", userId)

  if (error) {
    console.error("Error removing player from match:", error)
    return false
  }

  return true
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
export async function createNextThursdayMatch(price = 7.5): Promise<Match | null> {
  const date = getNextThursday()
  const time = "21:00"

  return createMatch({
    date,
    time,
    status: "registering",
    price, // Use the provided price
  })
}

// Get the active match (registering or ready)
export async function getActiveMatch(): Promise<Match | null> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return null
  }
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .in("status", ["registering", "ready"])
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
