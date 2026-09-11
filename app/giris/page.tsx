"use client"

// Deep-linkable sign-in / claim page. Same panel as the home page's account tab.

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { AccountPanel } from "@/app/components/account-panel"
import { useTranslation } from "@/lib/i18n/useTranslation"

export default function SignInPage() {
  const { t } = useTranslation()

  return (
    <div className="container mx-auto max-w-md px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t("auth.title")}</h1>
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("common.backHome")}
          </Button>
        </Link>
      </div>
      <AccountPanel />
    </div>
  )
}
