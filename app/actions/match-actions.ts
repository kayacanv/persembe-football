"use server"

import { createServerClient } from "@/app/lib/supabase"

// Update match date
export async function updateMatchDate(matchId: string, date: string) {
  try {
    const supabase = createServerClient()
    if (!supabase) {
      return { success: false, error: "Database connection failed" }
    }

    // Validate date format (DD.MM.YYYY)
    const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/
    if (!dateRegex.test(date)) {
      return { success: false, error: "Invalid date format. Use DD.MM.YYYY" }
    }

    const { error } = await supabase.from("matches").update({ date }).eq("id", matchId)

    if (error) {
      console.error("Error updating match date:", error)
      return { success: false, error: "Failed to update match date" }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in updateMatchDate:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

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
