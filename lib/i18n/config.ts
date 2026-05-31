export const locales = ["tr", "en"] as const

export type Locale = (typeof locales)[number]

/** Turkish is always the default and the fallback language. */
export const defaultLocale: Locale = "tr"

/** Cookie that remembers an explicit language choice (1 year). */
export const LOCALE_COOKIE = "locale"
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "tr" || value === "en"
}
