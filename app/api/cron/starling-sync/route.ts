import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/app/lib/supabase"
import { getSettledIncomingFeed } from "@/app/lib/starling-server"
import { processFeedItem } from "@/app/lib/starling-match"

export const runtime = "nodejs"

// Backstop reconciliation: pulls the last 7 days of settled incoming Starling
// transactions and runs the same matcher the webhook uses, to catch anything a
// missed webhook delivery didn't record. Idempotent.
//
// Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically
// when CRON_SECRET is set. Also accepts `?secret=` for manual runs.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error("CRON_SECRET not set — rejecting sync request")
    return false
  }
  const header = req.headers.get("authorization")
  const querySecret = req.nextUrl.searchParams.get("secret")
  return header === `Bearer ${secret}` || querySecret === secret
}

async function runSync() {
  const supabase = createServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Database connection failed" }, { status: 500 })
  }

  const max = new Date()
  const min = new Date(max.getTime() - 7 * 24 * 60 * 60 * 1000)

  const items = await getSettledIncomingFeed(min.toISOString(), max.toISOString())

  const results = []
  for (const item of items) {
    results.push(await processFeedItem(supabase, item))
  }

  const summary = {
    fetched: items.length,
    matched: results.filter((r) => r.status === "matched").length,
    unmatched: results.filter((r) => r.status === "unmatched").length,
    skipped: results.filter((r) => r.status === "skipped").length,
  }
  console.log("Starling cron sync:", summary)
  return NextResponse.json({ ok: true, ...summary, results })
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    return await runSync()
  } catch (err: any) {
    console.error("Starling cron sync error:", err)
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 })
  }
}

// Vercel Cron issues GET; POST kept for manual/curl parity.
export const POST = GET
