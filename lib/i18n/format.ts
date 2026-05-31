import { format as formatDate } from "date-fns"
import { enUS, tr } from "date-fns/locale"
import type { Locale } from "./config"

const dateFnsLocales = { tr, en: enUS } as const

/** Parse the app's `DD.MM.YYYY` date strings, falling back to the Date constructor. */
function parseDate(value: string | Date): Date {
  if (value instanceof Date) return value
  if (typeof value === "string" && value.includes(".")) {
    const [day, month, year] = value.split(".")
    const d = new Date(Number(year), Number(month) - 1, Number(day))
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date(value)
}

/** Short readable match date: "12 Mart" / "12 March". */
export function formatMatchDate(value: string | Date, locale: Locale): string {
  try {
    return formatDate(parseDate(value), "d MMMM", { locale: dateFnsLocales[locale] })
  } catch {
    return typeof value === "string" ? value : ""
  }
}

/** Full date: "12 Mart 2026" / "12 March 2026". */
export function formatFullDate(value: string | Date, locale: Locale): string {
  try {
    return formatDate(parseDate(value), "d MMMM yyyy", { locale: dateFnsLocales[locale] })
  } catch {
    return typeof value === "string" ? value : ""
  }
}
