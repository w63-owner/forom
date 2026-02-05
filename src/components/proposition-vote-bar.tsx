"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ThumbsDown, ThumbsUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSupabaseClient } from "@/utils/supabase/client"
import { useToast } from "@/components/ui/toast"

type Props = {
  propositionId: string
  initialVotes: number
  propositionPageId: string | null
}

export function PropositionVoteBar({
  propositionId,
  initialVotes,
  propositionPageId,
}: Props) {
  const router = useRouter()
  const [votes, setVotes] = useState(initialVotes)
  const [currentVote, setCurrentVote] = useState<"Upvote" | "Downvote" | null>(
    null
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()
  const [ownerNotifyDaily, setOwnerNotifyDaily] = useState(false)
  const [ownerVoteThreshold, setOwnerVoteThreshold] = useState<number | null>(
    null
  )

  const refreshVotes = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { data: voteRows, error: votesError } = await supabase
      .from("votes")
      .select("type")
      .eq("proposition_id", propositionId)
    if (!votesError && voteRows) {
      const computed = voteRows.reduce((sum, row) => {
        if (row.type === "Upvote") return sum + 1
        if (row.type === "Downvote") return sum - 1
        return sum
      }, 0)
      setVotes(computed)
      return computed
    }
    const { data } = await supabase
      .from("propositions")
      .select("votes_count")
      .eq("id", propositionId)
      .single()
    if (data) {
      const v = data.votes_count ?? 0
      setVotes(v)
      return v
    }
  }

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data: session }) => {
      const userId = session.user?.id ?? null
      if (!userId) return
      supabase
        .from("votes")
        .select("type")
        .eq("proposition_id", propositionId)
        .eq("user_id", userId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.type) setCurrentVote(data.type)
        })
    })
  }, [propositionId])

  useEffect(() => {
    if (!propositionPageId) return
    const supabase = getSupabaseClient()
    if (!supabase) return
    supabase
      .from("pages")
      .select("owner_notify_daily, owner_vote_threshold")
      .eq("id", propositionPageId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setOwnerNotifyDaily(Boolean(data.owner_notify_daily))
          setOwnerVoteThreshold(data.owner_vote_threshold ?? null)
        }
      })
  }, [propositionPageId])

  const handleVote = async (type: "Upvote" | "Downvote") => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError("Supabase non configuré.")
      return
    }
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push(`/login?next=/propositions/${propositionId}`)
      return
    }
    setLoading(true)
    setError(null)
    const { error: voteError } = await supabase.from("votes").upsert(
      {
        user_id: userData.user.id,
        proposition_id: propositionId,
        type,
      },
      { onConflict: "user_id,proposition_id" }
    )
    if (voteError) {
      setError(voteError.message)
      setLoading(false)
      showToast({
        variant: "error",
        title: "Vote impossible",
        description: voteError.message,
      })
      return
    }
    setCurrentVote(type)
    const previousVotes = votes
    const nextVotes = await refreshVotes()
    if (
      propositionPageId &&
      !ownerNotifyDaily &&
      ownerVoteThreshold != null &&
      nextVotes != null &&
      previousVotes < ownerVoteThreshold &&
      nextVotes >= ownerVoteThreshold
    ) {
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "owner_vote_threshold",
          propositionId,
          actorUserId: userData.user.id,
        }),
      }).catch(() => null)
    }
    showToast({
      variant: type === "Upvote" ? "success" : "info",
      title: type === "Upvote" ? "Vote positif enregistré" : "Vote négatif enregistré",
    })
    setLoading(false)
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            className={
              currentVote === "Upvote"
                ? "text-primary"
                : "text-muted-foreground"
            }
            onClick={() => handleVote("Upvote")}
            disabled={loading}
          >
            <ThumbsUp className="size-4" />
          </Button>
          <span className="min-w-[1.75rem] text-center text-sm font-medium text-foreground">
            {Math.max(0, votes)}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className={
              currentVote === "Downvote"
                ? "text-destructive"
                : "text-muted-foreground"
            }
            onClick={() => handleVote("Downvote")}
            disabled={loading}
          >
            <ThumbsDown className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
