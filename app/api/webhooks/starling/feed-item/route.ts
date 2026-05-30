import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createServerClient } from "@/app/lib/supabase"
import { processFeedItem } from "@/app/lib/starling-match"
import type { StarlingFeedItem } from "@/app/lib/starling-server"

// Needs Node's crypto for RSA signature verification.
export const runtime = "nodejs"

// Wrap a bare base64 SPKI key (as copied from the Starling portal Keys tab) into
// PEM, or pass through if it is already PEM.
function toPem(key: string): string {
  const k = key.replace(/\\n/g, "\n").trim()
  if (k.includes("BEGIN PUBLIC KEY")) return k
  const lines = k.replace(/\s+/g, "").match(/.{1,64}/g) ?? []
  return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----\n`
}

// Starling signs each payload with its private key; we verify with the public
// key from the portal. Header is `X-Hook-Signature` (base64). RSA-SHA512.
function verifySignature(rawBody: string, signature: string | null): boolean {
  const publicKey = process.env.STARLING_WEBHOOK_PUBLIC_KEY
  if (!publicKey) {
    console.error("STARLING_WEBHOOK_PUBLIC_KEY not set — rejecting webhook")
    return false
  }
  if (!signature) return false
  try {
    return crypto.verify(
      "sha512",
      Buffer.from(rawBody, "utf8"),
      toPem(publicKey),
      Buffer.from(signature, "base64"),
    )
  } catch (err) {
    console.error("Starling signature verification error:", err)
    return false
  }
}

// The webhook payload wraps the feed item; pull it out into our shape.
function toFeedItem(payload: any): StarlingFeedItem | null {
  const c = payload?.content ?? payload
  if (!c || !c.feedItemUid || !c.amount) return null
  return {
    feedItemUid: c.feedItemUid,
    categoryUid: c.categoryUid,
    amount: c.amount,
    direction: c.direction,
    status: c.status,
    source: c.source,
    reference: c.reference,
    counterPartyName: c.counterPartyName,
    transactionTime: c.transactionTime,
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get("x-hook-signature")

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const item = toFeedItem(payload)
  if (!item) {
    // Acknowledge non-feed-item notifications so Starling doesn't retry forever.
    return NextResponse.json({ received: true, ignored: true })
  }

  const supabase = createServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Database connection failed" }, { status: 500 })
  }

  try {
    const result = await processFeedItem(supabase, item)
    console.log("Starling webhook processed:", result)
    return NextResponse.json({ received: true, result })
  } catch (err: any) {
    console.error("Starling webhook processing error:", err)
    // 200 so a transient processing error still ACKs; the cron backstop re-tries.
    return NextResponse.json({ received: true, error: String(err?.message ?? err) })
  }
}
