// Bulk voting, one page per attribute: /bulk-vote?attribute=pace (see
// STAT_SLUGS for the others). A missing or unknown attribute goes to pace.

import { redirect } from "next/navigation"
import { BulkVoteBoard } from "@/app/components/bulk-vote-board"
import { STAT_SLUGS, statFromSlug } from "@/app/lib/rating-stats"

export default async function BulkVotePage({
  searchParams,
}: {
  searchParams: Promise<{ attribute?: string | string[] }>
}) {
  const { attribute } = await searchParams
  const stat = statFromSlug(typeof attribute === "string" ? attribute : undefined)
  if (!stat) redirect(`/bulk-vote?attribute=${STAT_SLUGS.pac}`)

  return <BulkVoteBoard stat={stat} />
}
