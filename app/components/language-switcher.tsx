"use client"

import { locales } from "@/lib/i18n/config"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { cn } from "@/lib/utils"

/** Compact TR | EN toggle for the top-right of the home page. Mobile-first. */
export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation()

  return (
    <div className="inline-flex shrink-0 items-center rounded-full border bg-muted p-0.5 text-xs font-semibold">
      {locales.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          aria-label={code.toUpperCase()}
          className={cn(
            "rounded-full px-3 py-1.5 uppercase transition-colors",
            locale === code
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {code}
        </button>
      ))}
    </div>
  )
}
