"use server"

// Admin-only match fixes a player cannot make for themselves. Like the
// hand-marked payments, these check for a real admin session (public.admins),
// not ?admin=true.

import { createServerClient } from "../lib/supabase"
import { getCurrentPlayer } from "../lib/supabase-ssr"
import { unlinkBankPaymentsForMatchPlayer } from "./starling-actions"

export type AdminRemoveResult = "removed" | "blocked_paid" | "forbidden" | "error"

type RemovalRow = {
  status: string
  has_paid: boolean | null
  match_id: string
  matches: { status: string } | { status: string }[] | null
}

// Take a player off a match at any stage, finished matches included, with no
// phone check. A paid player is still refused unless the payment was only a
// hand mark: card and bank payments keep their trail. The hand-mark row goes
// with the registration (ON DELETE CASCADE in add-manual-payments.sql).
//
// A reserve moves up into a freed slot only while the match is still open. On a
// finished match that would quietly put someone who may not have played on the
// unpaid list.
export async function adminRemovePlayerFromMatch(matchPlayerId: string): Promise<AdminRemoveResult> {
  const me = await getCurrentPlayer()
  if (!me?.is_admin) return "forbidden"

  const supabase = createServerClient()
  if (!supabase) return "error"

  const { data, error: fetchError } = await supabase
    .from("match_players")
    .select("status, has_paid, match_id, matches(status)")
    .eq("id", matchPlayerId)
    .maybeSingle()

  if (fetchError || !data) {
    console.error("adminRemovePlayerFromMatch fetch:", fetchError?.message)
    return "error"
  }
  const row = data as unknown as RemovalRow

  if (row.has_paid) {
    const { data: manual } = await supabase
      .from("manual_payments")
      .select("match_player_id")
      .eq("match_player_id", matchPlayerId)
      .maybeSingle()
    if (!manual) return "blocked_paid"
  }

  // Never let the FK's ON DELETE SET NULL leave a "matched" bank payment with no
  // player behind it.
  const unlink = await unlinkBankPaymentsForMatchPlayer(matchPlayerId)
  if (!unlink.success) {
    console.error("adminRemovePlayerFromMatch unlink:", unlink.error)
    return "error"
  }

  const { error: deleteError } = await supabase.from("match_players").delete().eq("id", matchPlayerId)
  if (deleteError) {
    console.error("adminRemovePlayerFromMatch delete:", deleteError.message)
    return "error"
  }

  const match = Array.isArray(row.matches) ? row.matches[0] : row.matches
  if (row.status === "active" && match?.status !== "done") {
    const { data: waitlisted, error: waitlistError } = await supabase
      .from("match_players")
      .select("id")
      .eq("match_id", row.match_id)
      .eq("status", "waitlist")
      .order("registration_date", { ascending: true })
      .limit(1)

    if (waitlistError) {
      console.error("adminRemovePlayerFromMatch waitlist:", waitlistError.message)
    } else if (waitlisted && waitlisted.length > 0) {
      const { error: promoteError } = await supabase
        .from("match_players")
        .update({ status: "active" })
        .eq("id", waitlisted[0].id)
      if (promoteError) console.error("adminRemovePlayerFromMatch promote:", promoteError.message)
    }
  }

  return "removed"
}
