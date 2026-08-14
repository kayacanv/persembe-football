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

// Update match kickoff time
export async function updateMatchTime(matchId: string, time: string) {
  try {
    const supabase = createServerClient()
    if (!supabase) {
      return { success: false, error: "Database connection failed" }
    }

    // Validate time format (24h HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/
    if (!timeRegex.test(time)) {
      return { success: false, error: "Invalid time format. Use HH:MM" }
    }

    const { error } = await supabase.from("matches").update({ time }).eq("id", matchId)

    if (error) {
      console.error("Error updating match time:", error)
      return { success: false, error: "Failed to update match time" }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in updateMatchTime:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Update match price (pitch fee per player, in decimal pounds)
export async function updateMatchPrice(
  matchId: string,
  price: number,
): Promise<{ success: boolean; error?: string; price?: number }> {
  try {
    const supabase = createServerClient()
    if (!supabase) {
      return { success: false, error: "Database connection failed" }
    }

    // Validate price: a finite, non-negative amount with at most 2 decimals
    if (!Number.isFinite(price) || price < 0 || price > 1000) {
      return { success: false, error: "Price must be between £0 and £1000" }
    }
    const rounded = Math.round(price * 100) / 100

    const { error } = await supabase.from("matches").update({ price: rounded }).eq("id", matchId)

    if (error) {
      console.error("Error updating match price:", error)
      return { success: false, error: "Failed to update match price" }
    }

    return { success: true, price: rounded }
  } catch (error) {
    console.error("Error in updateMatchPrice:", error)
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
