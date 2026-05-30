// Unique, date-bearing payment reference for a (match, player).
//
// PURE module — no server imports — so it can be used both in client components
// (to show the player which reference to use) and on the server (to match an
// incoming Starling transaction back to that player).
//
// Format: PF-DDMM-XXXX
//   PF    pitch fee marker
//   DDMM  day + month of the match (from the "DD.MM.YYYY" match date)
//   XXXX  first 4 hex chars of the match_player id, uppercased
//
// Because XXXX is derived from the unique match_player row, the whole code is
// unique per registration — matching is deterministic, not fuzzy.

// Strip everything but A-Z0-9 and uppercase, so "pf 1206 ab12" and "PF-1206-AB12"
// compare equal. Used on both the generated code and the payer-supplied reference.
export function normalizeRef(input: string | null | undefined): string {
  return (input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")
}

// matchDate is the stored match date string "DD.MM.YYYY"; matchPlayerId is the
// match_players.id UUID.
export function paymentRef(matchDate: string, matchPlayerId: string): string {
  const [dd = "", mm = ""] = matchDate.split(".")
  const ddmm = `${dd}${mm}`.padStart(4, "0").slice(0, 4)
  const token = matchPlayerId.replace(/[^a-fA-F0-9]/g, "").slice(0, 4).toUpperCase()
  return `PF-${ddmm}-${token}`
}
