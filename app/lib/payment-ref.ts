// Unique, date-bearing payment reference for a (match, player).
//
// PURE module — no server imports — so it can be used both in client components
// (to show the player which reference to use) and on the server (to match an
// incoming Starling transaction back to that player).
//
// Format: NAM-DDMM-WXYZ
//   NAM   first 3 letters of the player's name (A-Z only, padded with X)
//   DDMM  day + month of the match (from the "DD.MM.YYYY" match date), e.g. 2805
//   WXYZ  4 letters DERIVED from the match_player id (look random, but
//         reproducible — required so the matcher can recompute the same code
//         without storing it)
//
// Because WXYZ is derived from the unique match_player row, the whole code is
// unique per registration — matching is deterministic, not fuzzy.

// Transliterate Turkish letters to their English equivalents so "Şükrü" -> "SUKRU"
// (rather than dropping ş/ü). Applied before stripping to A-Z.
const TR_MAP: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i", ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
}
function toAscii(input: string | null | undefined): string {
  return (input ?? "").replace(/[çÇğĞıİöÖşŞüÜ]/g, (m) => TR_MAP[m] ?? m)
}

// Strip everything but A-Z0-9 and uppercase, so "abc 2805 wxyz" and "ABC-2805-WXYZ"
// compare equal. Used on both the generated code and the payer-supplied reference.
export function normalizeRef(input: string | null | undefined): string {
  return toAscii(input).toUpperCase().replace(/[^A-Z0-9]/g, "")
}

// First 3 A-Z letters of the name (Turkish letters cast to English), padded to 3
// with X for very short names.
function namePart(name: string | null | undefined): string {
  const letters = toAscii(name).toUpperCase().replace(/[^A-Z]/g, "")
  return (letters.slice(0, 3) || "").padEnd(3, "X")
}

// Deterministic 4 uppercase letters from a seed (FNV-1a hash). Looks random,
// always reproduces the same letters for the same id.
function derivedLetters(seed: string, n: number): string {
  let h = 0x811c9dc5 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  let out = ""
  for (let i = 0; i < n; i++) {
    out += String.fromCharCode(65 + (h % 26))
    h = Math.imul(h ^ (i + 1), 0x01000193) >>> 0
  }
  return out
}

// matchDate is the stored match date string "DD.MM.YYYY"; matchPlayerId is the
// match_players.id UUID; name is the player's display name.
export function paymentRef(matchDate: string, matchPlayerId: string, name: string): string {
  const [dd = "", mm = ""] = matchDate.split(".")
  const ddmm = `${dd}${mm}`.padStart(4, "0").slice(0, 4)
  return `${namePart(name)}-${ddmm}-${derivedLetters(matchPlayerId, 4)}`
}
