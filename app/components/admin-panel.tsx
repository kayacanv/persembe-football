"use client"

// Home-page shortcuts for admins (players listed in public.admins): one tap to
// each admin view. The views themselves still switch on ?admin=true, so every
// link carries it.

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ArrowRight, Calendar, ClipboardList, Landmark, PiggyBank, Plus, ShieldCheck } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { formatMatchDate } from "@/lib/i18n/format"
import type { Match } from "@/app/lib/types"

type AdminPanelProps = {
  activeMatch: Match | null
  lastMatch: Match | null
  // Matches still loading: hide the match rows rather than flash "create match".
  loading: boolean
  onCreateMatch: () => void
}

type Shortcut = {
  key: string
  icon: LucideIcon
  title: string
  description: string
} & ({ href: string } | { onClick: () => void })

const ROW_CLASS = "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"

export function AdminPanel({ activeMatch, lastMatch, loading, onCreateMatch }: AdminPanelProps) {
  const { t, locale } = useTranslation()

  const shortcuts: Shortcut[] = []

  if (!loading) {
    shortcuts.push(
      activeMatch
        ? {
            key: "active",
            icon: Calendar,
            title: t("admin.panelActiveMatch", { date: formatMatchDate(activeMatch.date, locale) }),
            description: t("admin.panelActiveMatchDesc"),
            href: `/match/${activeMatch.id}?admin=true`,
          }
        : {
            key: "create",
            icon: Plus,
            title: t("admin.panelCreateMatch"),
            description: t("admin.panelCreateMatchDesc"),
            onClick: onCreateMatch,
          },
    )
    if (lastMatch) {
      shortcuts.push({
        key: "last",
        icon: ClipboardList,
        title: t("admin.panelLastMatch", { date: formatMatchDate(lastMatch.date, locale) }),
        description: t("admin.panelLastMatchDesc"),
        href: `/match/${lastMatch.id}?admin=true`,
      })
    }
  }

  shortcuts.push(
    {
      key: "piggy",
      icon: PiggyBank,
      title: t("admin.panelPiggy"),
      description: t("admin.panelPiggyDesc"),
      href: "/kumbara?admin=true",
    },
    {
      key: "starling",
      icon: Landmark,
      title: t("admin.panelStarling"),
      description: t("admin.panelStarlingDesc"),
      href: "/admin/starling?admin=true",
    },
  )

  return (
    <Card className="mb-6 overflow-hidden border-blue-300 dark:border-blue-800">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2 text-sm font-semibold text-blue-700 dark:text-blue-400">
        <ShieldCheck className="h-4 w-4" />
        {t("admin.panelTitle")}
      </div>
      <CardContent className="divide-y p-0">
        {shortcuts.map((s) => {
          const body = (
            <>
              <s.icon className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.title}</p>
                <p className="truncate text-xs text-muted-foreground">{s.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </>
          )
          return "href" in s ? (
            <Link key={s.key} href={s.href} className={ROW_CLASS}>
              {body}
            </Link>
          ) : (
            <button key={s.key} type="button" onClick={s.onClick} className={ROW_CLASS}>
              {body}
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}

export default AdminPanel
