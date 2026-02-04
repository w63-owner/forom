"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/utils/supabase/client"
import { useToast } from "@/components/ui/toast"

type Props = {
  propositionId: string
  initialVotes: number
}

export function PageVoteToggle({ propositionId, initialVotes }: Props) {
  const router = useRouter()
  const [votes, setVotes] = useState(initialVotes)
  const [loading, setLoading] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    const fetchVote = async () => {
      const supabase = getSupabaseClient()
      if (!supabase) return
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return
      const { data } = await supabase
        .from("votes")
        .select("type")
        .eq("proposition_id", propositionId)
        .eq("user_id", userData.user.id)
        .maybeSingle()
      if (data?.type === "Upvote") {
        setHasVoted(true)
      }
    }
    fetchVote()
  }, [propositionId])

  const toggleVote = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push(`/login?next=/propositions/${propositionId}`)
      return
    }
    setLoading(true)
    if (hasVoted) {
      await supabase
        .from("votes")
        .delete()
        .eq("proposition_id", propositionId)
        .eq("user_id", userData.user.id)
      setHasVoted(false)
      setVotes((prev) => Math.max(0, prev - 1))
      showToast({
        variant: "info",
        title: "Vote retiré",
      })
    } else {
      await supabase.from("votes").upsert(
        {
          user_id: userData.user.id,
          proposition_id: propositionId,
          type: "Upvote",
        },
        { onConflict: "user_id,proposition_id" }
      )
      setHasVoted(true)
      setVotes((prev) => prev + 1)
      showToast({
        variant: "success",
        title: "Vote enregistré",
      })
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <span className="text-sm font-medium text-foreground">{votes}</span>
      <button
        type="button"
        onClick={toggleVote}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors transition-transform duration-150 hover:bg-accent active:scale-[0.98] disabled:opacity-50 w-16"
      >
        {hasVoted ? "✓" : "Voter"}
      </button>
    </div>
  )
}
