"use server"

import { createServerClient } from "@/app/lib/supabase"
import type { Team } from "@/app/lib/types"

// One placed player. field_x/field_y (0-100 %) are the source of truth for the on-pitch
// layout; `position` is a legacy 1-5 line rank kept only so the old column stays meaningful.
export interface PlacementInput {
  match_player_id: string
  team: "A" | "B"
  position: number
  field_x: number
  field_y: number
}

// Save the free-form formation for a match: reset everyone, then write the placed players.
export async function saveTeamPositions(matchId: string, placements: PlacementInput[]) {
  try {
    const supabase = createServerClient()
    if (!supabase) {
      return { success: false, error: "Database connection failed" }
    }

    // Reset all players in the match to unassigned (also clears any prior coordinates).
    const { error: resetError } = await supabase
      .from("match_players")
      .update({ position: 0, team: null, field_x: null, field_y: null })
      .eq("match_id", matchId)

    if (resetError) {
      console.error("Error resetting player positions:", resetError)
      return { success: false, error: "Failed to reset player positions" }
    }

    if (placements.length > 0) {
      const updates = placements.map((p) => ({
        id: p.match_player_id,
        position: p.position,
        team: p.team as Team,
        field_x: p.field_x,
        field_y: p.field_y,
      }))

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
