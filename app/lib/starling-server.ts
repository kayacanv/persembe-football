// Starling Bank API client — SERVER ONLY (uses the Personal Access Token).
// Never import this from a client component.

const STARLING_API_BASE = process.env.STARLING_API_BASE || "https://api.starlingbank.com"

export type StarlingFeedItem = {
  feedItemUid: string
  categoryUid: string
  amount: { currency: string; minorUnits: number }
  direction: "IN" | "OUT"
  status: string
  source: string
  reference?: string
  counterPartyName?: string
  transactionTime: string
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing ${name} environment variable`)
  return v
}

async function starlingGet(path: string): Promise<any> {
  const token = requireEnv("STARLING_ACCESS_TOKEN")
  const res = await fetch(`${STARLING_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    // Always hit the live API; never cache bank data.
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Starling API ${res.status} for ${path}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

// Fetch settled INCOMING feed items between two ISO timestamps. Used by the cron
// backstop; the webhook delivers items directly so it does not call this.
export async function getSettledIncomingFeed(
  minTransactionTimestamp: string,
  maxTransactionTimestamp: string,
): Promise<StarlingFeedItem[]> {
  const accountUid = requireEnv("STARLING_ACCOUNT_UID")
  const categoryUid = requireEnv("STARLING_CATEGORY_UID")

  const qs = new URLSearchParams({ minTransactionTimestamp, maxTransactionTimestamp })
  const data = await starlingGet(
    `/api/v2/feed/account/${accountUid}/category/${categoryUid}/transactions-between?${qs.toString()}`,
  )

  const items: StarlingFeedItem[] = data.feedItems ?? []
  return items.filter((it) => it.direction === "IN" && it.status === "SETTLED")
}
