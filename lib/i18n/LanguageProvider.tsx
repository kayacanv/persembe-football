"use client"

import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react"
import {
  defaultLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
} from "./config"
import { dictionaries } from "./dictionaries"

type Vars = Record<string, string | number>

interface LanguageContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  /** Translate a dot-path key, interpolating `{var}` placeholders. Falls back to Turkish. */
  t: (key: string, vars?: Vars) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function resolve(dict: unknown, key: string): string | undefined {
  const value = key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, dict)
  return typeof value === "string" ? value : undefined
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match,
  )
}

export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale
  children: ReactNode
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    if (typeof document !== "undefined") {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`
      document.documentElement.lang = next
    }
  }, [])

  const t = useCallback(
    (key: string, vars?: Vars) => {
      const fromLocale = resolve(dictionaries[locale], key)
      const fallback = resolve(dictionaries[defaultLocale], key)
      return interpolate(fromLocale ?? fallback ?? key, vars)
    },
    [locale],
  )

  const value = useMemo<LanguageContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useTranslation(): LanguageContextValue {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider")
  }
  return context
}
