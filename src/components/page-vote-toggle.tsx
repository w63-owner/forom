"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useToast } from "@/components/ui/toast"
import { AsyncTimeoutError } from "@/lib/async-resilience"
import { PropositionVoteButton } from "@/components/proposition-vote-button"
import { usePropositionVote } from "@/hooks/use-proposition-vote"
import { ensureFreshSession } from "@/lib/auth/ensure-fresh-session"
import { getSupabaseClient } from "@/utils/supabase/client"

type Props = {
  propositionId: string
  initialVotes: number
  initialHasVoted?: boolean
  onVoteChange?: (payload: {
    propositionId: string
    hasVoted: boolean
    votes: number
  }) => void
}

export function PageVoteToggle({
  propositionId,
  initialVotes,
  initialHasVoted,
  onVoteChange,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tCommon = useTranslations("Common")
  const tVote = useTranslations("Vote")
  const { showToast } = useToast()
  const { votes, hasVoted, loading, toggleVote: runToggleVote } = usePropositionVote({
    propositionId,
    initialVotes,
    initialHasVoted,
    syncOnMount: false,
    syncOnVisibility: false,
  })

  const toggleVote = async () => {
    try {
      const supabase = getSupabaseClient()
      if (supabase) {
        const session = await ensureFreshSession(supabase)
        if (!session.ok) {
          if (session.kind === "unauthenticated") {
            const currentPath = `${pathname || "/"}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
            const nextParams = new URLSearchParams(searchParams.toString())
            nextParams.set("auth", "signup")
            nextParams.set("next", currentPath)
            showToast({
              variant: "warning",
              title: tVote("loginRequiredTitle"),
              description: tVote("loginRequiredBody"),
            })
            router.replace(`${pathname || "/"}?${nextParams.toString()}`)
            return
          }
          if (session.kind === "transient") {
            showToast({
              variant: "warning",
              title: tCommon("sessionReconnectingTitle"),
              description: tVote("sessionTransientBody"),
            })
            return
          }
        }
      }
      const result = await runToggleVote()
      if (!result.ok) {
        if (result.status === 401) {
          const currentPath = `${pathname || "/"}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
          const nextParams = new URLSearchParams(searchParams.toString())
          nextParams.set("auth", "signup")
          nextParams.set("next", currentPath)
          showToast({
            variant: "warning",
            title: tVote("loginRequiredTitle"),
            description: tVote("loginRequiredBody"),
          })
          router.replace(`${pathname || "/"}?${nextParams.toString()}`)
          return
        }
        if (result.status === 403) {
          showToast({
            variant: "warning",
            title: tCommon("permissionDeniedTitle"),
            description: tVote("permissionDeniedBody"),
          })
          return
        }
        const description = result.error ?? tVote("voteFailedTitle")
        showToast({
          variant: "error",
          title: tVote("voteFailedTitle"),
          description,
        })
        return
      }
      onVoteChange?.({
        propositionId,
        hasVoted: result.hasVoted,
        votes: result.votes,
      })
      showToast({
        variant: result.hasVoted ? "success" : "info",
        title: result.hasVoted
          ? tVote("voteRecordedTitle")
          : tVote("voteRemovedTitle"),
      })
    } catch (error) {
      const description =
        error instanceof AsyncTimeoutError
          ? tVote("voteTimeout")
          : error instanceof Error
            ? error.message
            : undefined
      showToast({
        variant: "error",
        title: tVote("voteFailedTitle"),
        description,
      })
    }
  }

  return (
    <div className="flex justify-end">
      <PropositionVoteButton
        votes={votes}
        hasVoted={hasVoted}
        loading={loading}
        onClick={toggleVote}
        ariaLabel={hasVoted ? tVote("voteRemovedTitle") : tCommon("vote")}
      />
    </div>
  )
}