// Canonical phone-number handling, shared by the home "Contact" tab, the profile
// editor and the match delete-verification check.
//
// Storage contract: every real phone is stored in `users.phone` as E.164 —
// "+" followed by the country dial code and the national number, digits only
// (e.g. "+447911123456"). That column is NOT NULL + UNIQUE, so when no number is
// provided we keep the legacy `no-phone-<timestamp>` placeholder instead of "".
//
// Privacy: numbers are write-only in the UI. Nothing here returns a value meant to
// be shown verbatim — `maskPhone()` is the only display helper and it hides the digits.

export type Country = {
  code: string // ISO 3166-1 alpha-2 — Select value + flag lookup
  name: string // English label (language-neutral enough for a phone picker)
  dial: string // dial code digits, no "+"
  flag: string // emoji flag
}

// UK first → it is the default. Curated for a UK-based, Turkish-organised club
// plus the common European/US countries members are likely to use.
export const COUNTRIES: Country[] = [
  { code: "GB", name: "United Kingdom", dial: "44", flag: "🇬🇧" },
  { code: "TR", name: "Türkiye", dial: "90", flag: "🇹🇷" },
  { code: "IE", name: "Ireland", dial: "353", flag: "🇮🇪" },
  { code: "DE", name: "Germany", dial: "49", flag: "🇩🇪" },
  { code: "FR", name: "France", dial: "33", flag: "🇫🇷" },
  { code: "NL", name: "Netherlands", dial: "31", flag: "🇳🇱" },
  { code: "ES", name: "Spain", dial: "34", flag: "🇪🇸" },
  { code: "IT", name: "Italy", dial: "39", flag: "🇮🇹" },
  { code: "PT", name: "Portugal", dial: "351", flag: "🇵🇹" },
  { code: "BE", name: "Belgium", dial: "32", flag: "🇧🇪" },
  { code: "PL", name: "Poland", dial: "48", flag: "🇵🇱" },
  { code: "US", name: "United States / Canada", dial: "1", flag: "🇺🇸" },
]

// UK is the default country code everywhere a picker starts blank.
export const DEFAULT_DIAL = "44"

export const PLACEHOLDER_PREFIX = "no-phone-"

// Generate the NOT-NULL/UNIQUE placeholder used when a user has no real number.
export function makePlaceholderPhone(): string {
  return `${PLACEHOLDER_PREFIX}${Date.now()}`
}

// A "phone" that is missing or auto-generated — i.e. the user has no real number.
export function isPlaceholderPhone(phone?: string | null): boolean {
  return !phone || phone.startsWith(PLACEHOLDER_PREFIX)
}

function digitsOnly(s: string): string {
  return (s || "").replace(/\D/g, "")
}

// Combine a dial code + locally-typed national number into canonical E.164.
// Strips spaces/punctuation and a leading national trunk "0" (UK/TR style).
// Returns "" when there is no real number to store.
export function toE164(dial: string, national: string): string {
  const n = digitsOnly(national).replace(/^0+/, "")
  if (!n) return ""
  return `+${digitsOnly(dial)}${n}`
}

// Split a stored value back into the editable {dial, national} parts so a picker can
// be pre-set to the right country. Placeholders/blanks fall back to the UK default
// with an empty number. NOTE: callers must NOT render `national` for other users —
// it is meant only for pre-filling the editor of the number's own owner.
export function parseStoredPhone(stored?: string | null): { dial: string; national: string } {
  if (isPlaceholderPhone(stored)) return { dial: DEFAULT_DIAL, national: "" }
  const raw = stored!.trim()
  const digits = digitsOnly(raw)

  if (raw.startsWith("+")) {
    // Longest dial code first so "1" doesn't shadow "353", etc.
    const dials = [...new Set(COUNTRIES.map((c) => c.dial))].sort((a, b) => b.length - a.length)
    for (const d of dials) {
      if (digits.startsWith(d)) return { dial: d, national: digits.slice(d.length) }
    }
    return { dial: DEFAULT_DIAL, national: digits } // unknown code — best effort
  }

  // Legacy un-prefixed number: treat as a national number under the default country,
  // dropping a single trunk "0".
  return { dial: DEFAULT_DIAL, national: digits.replace(/^0/, "") }
}

// Loose equality for the delete-verification check: compares trailing digits so a
// member can type their number with or without the country code / formatting and
// still match an E.164-stored value. Placeholders never match anything.
export function samePhone(a?: string | null, b?: string | null): boolean {
  if (isPlaceholderPhone(a) || isPlaceholderPhone(b)) return false
  const da = digitsOnly(a!)
  const db = digitsOnly(b!)
  if (da.length < 6 || db.length < 6) return false
  const [long, short] = da.length >= db.length ? [da, db] : [db, da]
  return long.endsWith(short)
}

// The ONLY display helper. Returns a masked hint that reveals no usable digits —
// e.g. "•••• ••89" — or null when there is no number on file.
export function maskPhone(phone?: string | null): string | null {
  if (isPlaceholderPhone(phone)) return null
  const digits = digitsOnly(phone!)
  if (digits.length < 4) return "••••"
  return `•••• ••${digits.slice(-2)}`
}
