// Login handles ("usernames"). Pure module — no Supabase, no React — so both the
// claim form and the server action can validate the same way, and so it can be
// exercised by a plain node script.
//
// A username is only a login handle: sign-in resolves it to the player's stored
// phone server-side. It is never an identity of its own.

// Must stay in sync with the users_username_format check in add-auth-accounts.sql.
// Lowercase slug: starts and ends alphanumeric, 3–24 chars, dots/underscores inside.
export const USERNAME_REGEX = /^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$/

export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 24

export function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username)
}

// Normalize whatever the user typed into the canonical stored form. Trimming and
// lowercasing only — anything still invalid afterwards is rejected, not silently
// rewritten, so nobody signs up as a handle they did not choose.
export function normalizeUsername(input: string): string {
  return (input || "").trim().toLowerCase()
}

// Turkish letters that Unicode normalization leaves alone (they are not composed
// of a base letter plus a combining mark).
const LETTER_MAP: Record<string, string> = {
  ı: "i",
  İ: "i",
  I: "i",
  ş: "s",
  Ş: "s",
  ğ: "g",
  Ğ: "g",
}

// Suggest a starting handle from a display name: "Yalın" → "yalin",
// "Fatih T 64" → "fatih.t.64", "Arda (Eski)" → "arda.eski".
export function suggestUsername(name: string): string {
  const mapped = (name || "")
    .normalize("NFKD")
    // Drop combining marks left behind by NFKD (é → e, ü → u, Ç → C).
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ıİIşŞğĞ]/g, (ch) => LETTER_MAP[ch] ?? ch)
    .toLowerCase()

  let slug = mapped
    // Any run of characters that cannot appear in a handle becomes one dot.
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, USERNAME_MAX_LENGTH)
    // Clamping can leave a trailing dot behind.
    .replace(/\.+$/g, "")

  if (!slug) slug = "player"
  while (slug.length < USERNAME_MIN_LENGTH) slug += "0"

  return slug
}
