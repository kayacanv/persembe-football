"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getMatchByDate } from "@/app/lib/data-service"

// Matches a DD-MM-YYYY style date slug. Separators may be "-", ".", or "/".
const DATE_SLUG = /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/

export default function DateRedirectPage({ params }: { params: { date: string } }) {
  const router = useRouter()
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function resolveMatch() {
      const match = DATE_SLUG.exec(decodeURIComponent(params.date))
      if (!match) {
        setNotFound(true)
        return
      }

      // Normalize to the DD.MM.YYYY format stored in the database.
      const [, day, month, year] = match
      const formattedDate = `${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`

      const found = await getMatchByDate(formattedDate)
      if (found) {
        router.replace(`/match/${found.id}`)
      } else {
        setNotFound(true)
      }
    }

    resolveMatch()
  }, [params.date, router])

  if (notFound) {
    return (
      <div className="container max-w-md mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-6">Maç Bulunamadı</h1>
        <p className="mb-4">Bu tarihte bir maç bulunamadı.</p>
        <Link href="/" passHref>
          <Button>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Ana Sayfaya Dön
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="container max-w-md mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p>Yönlendiriliyor...</p>
    </div>
  )
}
