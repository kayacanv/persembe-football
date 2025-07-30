import { getSupabaseBrowserClient } from "./supabase"
import type { User, PlayerMatchSummary, PlayerStats, TeammateStats } from "./types"
import {
  uploadPlayerPhoto as uploadPhotoToStorage,
  deletePlayerPhoto as deleteOldPhotoFromStorage,
} from "./storage-service"
import { parse } from "date-fns"

// Get user by ID
export async function getUserById(userId: string): Promise<User | null> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return null
  }

  const { data, error } = await supabase.from("users").select("*").eq("id", userId).single()

  if (error) {
    console.error("Error fetching user:", error)
    return null
  }

  return data
}

// Update user contact information (and potentially other fields like photo_url)
export async function updateUserProfile(
  userId: string,
  profileData: Partial<Pick<User, "phone" | "email" | "photo_url">>,
): Promise<boolean> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return false
  }

  const { error } = await supabase.from("users").update(profileData).eq("id", userId)

  if (error) {
    console.error("Error updating user profile:", error)
    return false
  }

  return true
}

// Update user contact information (kept for backward compatibility if used elsewhere)
export async function updateUserContact(
  userId: string,
  contactInfo: { phone?: string; email?: string },
): Promise<boolean> {
  return updateUserProfile(userId, contactInfo)
}

// Upload photo, update user record, and delete old photo if exists
export async function updateUserPhoto(userId: string, file: File, oldPhotoUrl?: string | null): Promise<string | null> {
  const newPhotoUrl = await uploadPhotoToStorage(userId, file)

  if (newPhotoUrl) {
    // If there was an old photo, try to delete it from storage
    if (oldPhotoUrl) {
      try {
        // Extract the path from the old URL.
        // Assumes URL is like: https://<project_ref>.supabase.co/storage/v1/object/public/player-photos/<file_path>
        const urlParts = oldPhotoUrl.split("/")
        const oldPhotoPath = urlParts.slice(urlParts.indexOf("player-photos") + 1).join("/")
        if (
          oldPhotoPath &&
          oldPhotoPath !==
            newPhotoUrl
              .split("/")
              .slice(urlParts.indexOf("player-photos") + 1)
              .join("/")
        ) {
          await deleteOldPhotoFromStorage(oldPhotoPath)
        }
      } catch (e) {
        console.warn("Could not delete old photo from storage:", e)
      }
    }

    // Update the user's photo_url in the database
    const success = await updateUserProfile(userId, { photo_url: newPhotoUrl })
    if (success) {
      return newPhotoUrl
    } else {
      // If DB update fails, try to delete the newly uploaded photo to avoid orphans
      try {
        const newUploadedPath = newPhotoUrl
          .split("/")
          .slice(newPhotoUrl.split("/").indexOf("player-photos") + 1)
          .join("/")
        await deleteOldPhotoFromStorage(newUploadedPath)
      } catch (e) {
        console.warn("Could not delete newly uploaded photo after DB update failure:", e)
      }
      return null
    }
  }
  return null
}

// Get player match history
export async function getPlayerMatchHistory(userId: string): Promise<PlayerMatchSummary[]> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return []
  }

  // Get all matches the player participated in
  const { data: matchPlayers, error: matchPlayersError } = await supabase
    .from("match_players")
    .select(`
      id,
      match_id,
      team,
      has_paid,
      matches (
        id,
        date,
        time,
        status,
        score_a,
        score_b
      )
    `)
    .eq("user_id", userId)
    .eq("status", "active") // Only include active participations
  if (matchPlayersError) {
    console.error("Error fetching player match history:", matchPlayersError)
    return []
  }

  // Transform the data
  const matchHistory: PlayerMatchSummary[] = matchPlayers.map((mp) => {
    const match = mp.matches
    let result: "win" | "loss" | "unknown" = "unknown"
    let score: string | null = null

    // Only calculate result if the match is done and has scores
    if (match.status === "done" && match.score_a !== null && match.score_b !== null) {
      if (mp.team === "A") {
        result = match.score_a > match.score_b ? "win" : "loss"
      } else if (mp.team === "B") {
        result = match.score_b > match.score_a ? "win" : "loss"
      }
      score = `${match.score_a} - ${match.score_b}`
    }

    return {
      matchId: match.id,
      date: match.date,
      time: match.time,
      team: mp.team,
      hasPaid: mp.has_paid,
      result,
      score,
    }
  })

  // Sort by match date + time (newest first)
  matchHistory.sort((a, b) => {
    const dateA = parse(`${a.date} ${a.time}`, "dd.MM.yyyy HH:mm", new Date())
    const dateB = parse(`${b.date} ${b.time}`, "dd.MM.yyyy HH:mm", new Date())
    return dateB.getTime() - dateA.getTime()
  })

  return matchHistory
}

// Get player statistics
export async function getPlayerStats(userId: string): Promise<PlayerStats | null> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return null
  }

  // Get all matches the player participated in
  const { data: matchPlayers, error: matchPlayersError } = await supabase
    .from("match_players")
    .select(`
      id,
      match_id,
      team,
      matches (
        id,
        status,
        score_a,
        score_b
      )
    `)
    .eq("user_id", userId)
    .eq("status", "active") // Only include active participations

  if (matchPlayersError) {
    console.error("Error fetching player match data:", matchPlayersError)
    return null
  }

  // Filter to only include completed matches
  const completedMatches = matchPlayers.filter(
    (mp) => mp.matches.status === "done" && mp.matches.score_a !== null && mp.matches.score_b !== null,
  )

  // Calculate statistics
  let wins = 0
  let losses = 0
  let teamAMatches = 0
  let teamAWins = 0
  let teamBMatches = 0
  let teamBWins = 0

  completedMatches.forEach((mp) => {
    const match = mp.matches

    if (mp.team === "A") {
      teamAMatches++
      if (match.score_a > match.score_b) {
        wins++
        teamAWins++
      } else {
        losses++
      }
    } else if (mp.team === "B") {
      teamBMatches++
      if (match.score_b > match.score_a) {
        wins++
        teamBWins++
      } else {
        losses++
      }
    }
  })

  const totalMatches = completedMatches.length
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0
  const teamAWinRate = teamAMatches > 0 ? Math.round((teamAWins / teamAMatches) * 100) : 0
  const teamBWinRate = teamBMatches > 0 ? Math.round((teamBWins / teamBMatches) * 100) : 0

  return {
    totalMatches,
    wins,
    losses,
    winRate,
    teamAMatches,
    teamAWins,
    teamAWinRate,
    teamBMatches,
    teamBWins,
    teamBWinRate,
  }
}

// Get player teammates statistics
export async function getPlayerTeammates(userId: string): Promise<TeammateStats[]> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.error("Supabase client is not initialized")
    return []
  }

  // Get all matches the player participated in
  const { data: playerMatches, error: playerMatchesError } = await supabase
    .from("match_players")
    .select("match_id, team")
    .eq("user_id", userId)
    .eq("status", "active")

  if (playerMatchesError || !playerMatches || playerMatches.length === 0) {
    console.error("Error fetching player matches:", playerMatchesError)
    return []
  }

  // Get all match IDs the player participated in
  const matchIds = playerMatches.map((pm) => pm.match_id)

  // Create a map of match ID to player's team
  const playerTeamMap = new Map<string, "A" | "B" | null>()
  playerMatches.forEach((pm) => {
    playerTeamMap.set(pm.match_id, pm.team)
  })

  // Get all players who played in the same matches
  const { data: otherMatchPlayers, error: otherMatchPlayersError } = await supabase
    .from("match_players")
    .select(`
      id,
      match_id,
      user_id,
      team,
      users (
        id,
        name
      ),
      matches (
        id,
        status,
        score_a,
        score_b
      )
    `)
    .in("match_id", matchIds)
    .eq("status", "active")
    .neq("user_id", userId) // Exclude the player themselves

  if (otherMatchPlayersError || !otherMatchPlayers) {
    console.error("Error fetching other match players:", otherMatchPlayersError)
    return []
  }

  // Group by other player
  const teammateStatsMap = new Map<
    string,
    {
      userId: string
      name: string
      matchesPlayedTogether: number
      winsTogether: number
      lossesTogether: number
      matchesPlayedAgainst: number
      winsAgainst: number
      lossesAgainst: number
    }
  >()

  otherMatchPlayers.forEach((omp) => {
    // Only count completed matches
    if (omp.matches.status !== "done" || omp.matches.score_a === null || omp.matches.score_b === null) {
      return
    }

    const otherPlayerId = omp.users.id
    const otherPlayerName = omp.users.name
    const matchId = omp.match_id

    // Get the primary player's team for this match
    const primaryPlayerTeam = playerTeamMap.get(matchId)
    const otherPlayerTeamInMatch = omp.team

    let stats = teammateStatsMap.get(otherPlayerId)
    if (!stats) {
      stats = {
        userId: otherPlayerId,
        name: otherPlayerName,
        matchesPlayedTogether: 0,
        winsTogether: 0,
        lossesTogether: 0,
        matchesPlayedAgainst: 0,
        winsAgainst: 0,
        lossesAgainst: 0,
      }
    }

    // Check if they played on the same team
    if (primaryPlayerTeam && otherPlayerTeamInMatch && primaryPlayerTeam === otherPlayerTeamInMatch) {
      stats.matchesPlayedTogether += 1
      let isWinTogether = false
      if (primaryPlayerTeam === "A" && omp.matches.score_a > omp.matches.score_b) {
        isWinTogether = true
      } else if (primaryPlayerTeam === "B" && omp.matches.score_b > omp.matches.score_a) {
        isWinTogether = true
      }
      if (isWinTogether) {
        stats.winsTogether += 1
      } else {
        stats.lossesTogether += 1
      }
    }
    // Check if they played against each other
    else if (primaryPlayerTeam && otherPlayerTeamInMatch && primaryPlayerTeam !== otherPlayerTeamInMatch) {
      stats.matchesPlayedAgainst += 1
      let primaryPlayerWonAgainst = false
      if (primaryPlayerTeam === "A" && omp.matches.score_a > omp.matches.score_b) {
        primaryPlayerWonAgainst = true
      } else if (primaryPlayerTeam === "B" && omp.matches.score_b > omp.matches.score_a) {
        primaryPlayerWonAgainst = true
      }

      if (primaryPlayerWonAgainst) {
        stats.winsAgainst += 1
      } else {
        stats.lossesAgainst += 1
      }
    }
    teammateStatsMap.set(otherPlayerId, stats)
  })

  // Convert to array and calculate win rates
  const result: TeammateStats[] = Array.from(teammateStatsMap.values()).map((stats) => ({
    userId: stats.userId,
    name: stats.name,
    matchesPlayedTogether: stats.matchesPlayedTogether,
    winsTogether: stats.winsTogether,
    lossesTogether: stats.lossesTogether,
    winRateTogether:
      stats.matchesPlayedTogether > 0 ? Math.round((stats.winsTogether / stats.matchesPlayedTogether) * 100) : 0,
    matchesPlayedAgainst: stats.matchesPlayedAgainst,
    winsAgainst: stats.winsAgainst,
    lossesAgainst: stats.lossesAgainst,
    winRateAgainst:
      stats.matchesPlayedAgainst > 0 ? Math.round((stats.winsAgainst / stats.matchesPlayedAgainst) * 100) : 0,
  }))
  return result
    .sort((a, b) => {
      return b.matchesPlayedAgainst + b.matchesPlayedTogether - a.matchesPlayedAgainst - a.matchesPlayedTogether
    })
    .filter(
   (b) => ( b.matchesPlayedAgainst + b.matchesPlayedTogether)>2
    )
    .slice(0,20)
}
