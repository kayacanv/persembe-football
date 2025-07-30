"use server"

import { createServerClient } from "@/app/lib/supabase"

// Update match score
export async function updateMatchScore(matchId: string, scoreA: number, scoreB: number) {
  try {
    const supabase = createServerClient()
    if (!supabase) {
      return { success: false, error: "Database connection failed" }
    }

    // Validate scores
    if (scoreA < 0 || scoreB < 0 || !Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
      return { success: false, error: "Scores must be non-negative integers" }
    }

    const { error } = await supabase.from("matches").update({ score_a: scoreA, score_b: scoreB }).eq("id", matchId)

    if (error) {
      console.error("Error updating match score:", error)
      return { success: false, error: "Failed to update match score" }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in updateMatchScore:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}
