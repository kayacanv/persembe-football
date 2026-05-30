"use client"

import { useEffect, useState } from "react"
import { Loader2, Star, Trophy } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import FifaCard from "@/app/components/fifa-card/fifa-card"
import {
  castVote,
  getMyVote,
  getVoteCounts,
  getVotingWindow,
} from "@/app/lib/mvp-service"
import type { Match, MvpVoteCount } from "@/app/lib/types"

interface MvpVotingProps {
  match: Pick<Match, "id" | "date" | "time">
}

export default function MvpVoting({ match }: MvpVotingProps) {
  const window_ = getVotingWindow(match)
  const [counts, setCounts] = useState<MvpVoteCount[]>([])
  const [myVote, setMyVote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState<string | null>(null)

  // Don't bother loading anything before voting opens.
  const active = window_.isOpen || window_.isClosed

  useEffect(() => {
    if (!active) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const [c, mine] = await Promise.all([getVoteCounts(match.id), getMyVote(match.id)])
        if (cancelled) return
        setCounts(c)
        setMyVote(mine)
      } catch (error) {
        console.error("Error loading MVP voting:", error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [match.id, active])

  async function handleVote(candidateId: string) {
    if (myVote || voting) return
    setVoting(candidateId)
    // Optimistic: lock the choice and bump the tally immediately.
    setMyVote(candidateId)
    setCounts((prev) =>
      prev
        .map((c) => (c.candidateId === candidateId ? { ...c, votes: c.votes + 1 } : c))
        .sort((a, b) => b.votes - a.votes),
    )

    const ok = await castVote(match.id, candidateId)
    if (!ok) {
      // Roll back on failure.
      setMyVote(null)
      setCounts((prev) =>
        prev
          .map((c) => (c.candidateId === candidateId ? { ...c, votes: Math.max(0, c.votes - 1) } : c))
          .sort((a, b) => b.votes - a.votes),
      )
      toast({ title: "Hata", description: "Oy verilemedi, tekrar dene.", variant: "destructive" })
    } else {
      toast({ title: "Oyun alındı", description: "MVP oyun kaydedildi." })
    }
    setVoting(null)
  }

  // --- Before the match ends: nothing to vote on yet. ---
  if (!active) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" /> Maçın MVP'si
          </CardTitle>
          <CardDescription>Oylama maçtan sonra açılır</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" /> Maçın MVP'si
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Yükleniyor...
        </CardContent>
      </Card>
    )
  }

  const totalVotes = counts.reduce((sum, c) => sum + c.votes, 0)
  const winner = counts[0] && counts[0].votes > 0 ? counts[0] : null

  // --- Closed: locked result. ---
  if (window_.isClosed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" /> Maçın MVP'si
          </CardTitle>
          <CardDescription>Oylama sona erdi</CardDescription>
        </CardHeader>
        <CardContent>
          {winner ? (
            <div className="space-y-4">
              <div className="mx-auto w-full max-w-[220px]">
                <FifaCard user={{ name: winner.name, photo_url: winner.photo_url }} />
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{winner.name}</div>
                <div className="text-sm text-muted-foreground">{winner.votes} oy</div>
              </div>
              {counts.length > 1 && counts[1].votes > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {counts.slice(1, 4).map(
                    (c) =>
                      c.votes > 0 && (
                        <Badge key={c.candidateId} variant="outline">
                          {c.name} · {c.votes}
                        </Badge>
                      ),
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">Bu maç için MVP oyu verilmedi</p>
          )}
        </CardContent>
      </Card>
    )
  }

  // --- Open: vote and/or watch the live tally. ---
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" /> Maçın MVP'si
        </CardTitle>
        <CardDescription>{myVote ? "Oyun alındı — canlı sonuçlar" : "Maçın MVP'sini seç"}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {counts.map((c) => {
            const pct = totalVotes > 0 ? Math.round((c.votes / totalVotes) * 100) : 0
            const isMine = myVote === c.candidateId
            return (
              <button
                key={c.candidateId}
                type="button"
                disabled={!!myVote || !!voting}
                onClick={() => handleVote(c.candidateId)}
                className={`relative w-full overflow-hidden rounded-md border px-3 py-2 text-left transition-colors ${
                  isMine ? "border-yellow-400 bg-yellow-50" : "hover:bg-muted disabled:hover:bg-transparent"
                } ${myVote ? "cursor-default" : "cursor-pointer"}`}
              >
                {/* Tally bar (only meaningful once the voter has voted). */}
                {myVote && (
                  <div
                    className="absolute inset-y-0 left-0 bg-yellow-100/70"
                    style={{ width: `${pct}%` }}
                    aria-hidden
                  />
                )}
                <div className="relative flex items-center justify-between">
                  <span className="flex items-center gap-2 font-medium">
                    {isMine && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                    {c.name}
                  </span>
                  {myVote && (
                    <span className="text-sm text-muted-foreground">
                      {c.votes} oy{voting === c.candidateId ? "…" : ""}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
        {myVote && (
          <p className="mt-3 text-center text-xs text-muted-foreground">Toplam {totalVotes} oy</p>
        )}
      </CardContent>
    </Card>
  )
}
