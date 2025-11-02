"use server"

import { createServerClient } from "@/app/lib/supabase"
import type { Team } from "@/app/lib/types"

const positionMap: Record<string, number> = {
  "defense-left": 1,
  "defense-center": 2,
  "defense-right": 3,
  "midfield-left": 4,
  "midfield-center": 5,
  "midfield-right": 6,
  "forward-left": 7,
  "forward-center": 8,
  "forward-right": 9,
}

// Save team positions to the database
export async function saveTeamPositions(
  matchId: string,
  teamA: Record<string, { id: string; match_player_id: string } | null>,
  teamB: Record<string, { id: string; match_player_id: string } | null>,
) {
  try {
    const supabase = createServerClient()
    if (!supabase) {
      return { success: false, error: "Database connection failed" }
    }

    // Prepare updates for all players in the match
    const updates = []

    // Instead of resetting all positions to null, we'll set a default value of 0 for unassigned positions
    const { error: resetError } = await supabase
      .from("match_players")
      .update({ position: 0, team: null })
      .eq("match_id", matchId)

    if (resetError) {
      console.error("Error resetting player positions:", resetError)
      return { success: false, error: "Failed to reset player positions" }
    }

    // Process Team A
    for (const [posId, player] of Object.entries(teamA)) {
      if (player) {
        updates.push({
          id: player.match_player_id,
          position: positionMap[posId],
          team: "A" as Team,
        })
      }
    }

    // Process Team B
    for (const [posId, player] of Object.entries(teamB)) {
      if (player) {
        updates.push({
          id: player.match_player_id,
          position: positionMap[posId],
          team: "B" as Team,
        })
      }
    }

    // Update all players in a single batch
    if (updates.length > 0) {
      const { error } = await supabase.from("match_players").upsert(updates)

      if (error) {
        console.error("Error saving team positions:", error)
        return { success: false, error: "Failed to save team positions" }
      }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in saveTeamPositions:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}
