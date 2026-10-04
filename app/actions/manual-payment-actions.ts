"use server"

// Admin-only: mark a registration paid by hand, with an optional note, for money
// that went somewhere the bank feed cannot see (Revolut, another account, cash).
//
// Unlike the older ?admin=true screens, these check the session: the caller must
// be listed in public.admins. Notes live in public.manual_payments, which is
// RLS-locked, so they are read and written with the service-role key only.
// match_players.has_paid stays the one "paid" flag every other screen reads.

import { createServerClient } from "../lib/supabase"
import { getCurrentPlayer } from "../lib/supabase-ssr"

// Mirrors the check constraint in add-manual-payments.sql (and the dialog's
// maxLength). Not exported: a "use server" module may only export async functions.
const MAX_MANUAL_NOTE_LENGTH = 200

export type ManualPayment = {
  match_player_id: string
  note: string | null
  marked_at: string
  marked_by_name: string | null
}

export type ManualPaymentResult =
  | { ok: true; payment: ManualPayment }
  | { ok: false; reason: "forbidden" | "not_found" | "error" }

export type UndoManualPaymentResult = { ok: true } | { ok: false; reason: "forbidden" | "not_found" | "error" }

async function requireAdmin() {
  const me = await getCurrentPlayer()
  return me?.is_admin ? me : null
}

// The hand-marked payments of one match, keyed by registration on the client.
export async function listManualPayments(matchId: string): Promise<ManualPayment[]> {
  if (!(await requireAdmin())) return []

  const supabase = createServerClient()
  if (!supabase) return []

  const { data: registrations, error: regError } = await supabase
    .from("match_players")
    .select("id")
    .eq("match_id", matchId)

  if (regError) {
    console.error("listManualPayments registrations:", regError.message)
    return []
  }
  const ids = (registrations ?? []).map((r) => r.id as string)
  if (ids.length === 0) return []

  const { data: rows, error } = await supabase
    .from("manual_payments")
    .select("match_player_id, note, marked_at, marked_by")
    .in("match_player_id", ids)

  if (error) {
    console.error("listManualPayments:", error.message)
    return []
  }
  if (!rows || rows.length === 0) return []

  const markerIds = [...new Set(rows.map((r) => r.marked_by).filter(Boolean))] as string[]
  const names = new Map<string, string>()
  if (markerIds.length > 0) {
    const { data: users } = await supabase.from("users").select("id, name").in("id", markerIds)
    for (const u of users ?? []) names.set(u.id, u.name)
  }

  return rows.map((r) => ({
    match_player_id: r.match_player_id,
    note: r.note,
    marked_at: r.marked_at,
    marked_by_name: r.marked_by ? (names.get(r.marked_by) ?? null) : null,
  }))
}

// Mark paid (or edit the note of an earlier hand mark). The note row is written
// first: if flipping has_paid then fails, the registration still shows unpaid
// with its note, and marking again simply retries.
export async function markPaidManually(matchPlayerId: string, note: string): Promise<ManualPaymentResult> {
  const me = await requireAdmin()
  if (!me) return { ok: false, reason: "forbidden" }

  const supabase = createServerClient()
  if (!supabase) return { ok: false, reason: "error" }

  const { data: registration } = await supabase
    .from("match_players")
    .select("id")
    .eq("id", matchPlayerId)
    .maybeSingle()
  if (!registration) return { ok: false, reason: "not_found" }

  const payment = {
    match_player_id: matchPlayerId,
    note: (note || "").trim().slice(0, MAX_MANUAL_NOTE_LENGTH) || null,
    marked_by: me.id,
    marked_at: new Date().toISOString(),
  }

  const { error: noteError } = await supabase.from("manual_payments").upsert(payment)
  if (noteError) {
    console.error("markPaidManually note:", noteError.message)
    return { ok: false, reason: "error" }
  }

  const { error: paidError } = await supabase.from("match_players").update({ has_paid: true }).eq("id", matchPlayerId)
  if (paidError) {
    console.error("markPaidManually has_paid:", paidError.message)
    return { ok: false, reason: "error" }
  }

  return {
    ok: true,
    payment: {
      match_player_id: payment.match_player_id,
      note: payment.note,
      marked_at: payment.marked_at,
      marked_by_name: me.name,
    },
  }
}

// Undo a hand mark. Only registrations with a manual_payments row qualify, so a
// card or bank payment can never be un-paid through this path.
export async function undoManualPayment(matchPlayerId: string): Promise<UndoManualPaymentResult> {
  if (!(await requireAdmin())) return { ok: false, reason: "forbidden" }

  const supabase = createServerClient()
  if (!supabase) return { ok: false, reason: "error" }

  const { data: deleted, error: deleteError } = await supabase
    .from("manual_payments")
    .delete()
    .eq("match_player_id", matchPlayerId)
    .select("match_player_id")

  if (deleteError) {
    console.error("undoManualPayment note:", deleteError.message)
    return { ok: false, reason: "error" }
  }
  if (!deleted || deleted.length === 0) return { ok: false, reason: "not_found" }

  const { error: paidError } = await supabase.from("match_players").update({ has_paid: false }).eq("id", matchPlayerId)
  if (paidError) {
    console.error("undoManualPayment has_paid:", paidError.message)
    return { ok: false, reason: "error" }
  }

  return { ok: true }
}
