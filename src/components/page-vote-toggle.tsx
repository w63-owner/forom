"use client"

import { useTranslations } from "next-intl"
import { useToast } from "@/components/ui/toast"
import { AsyncTimeoutError } from "@/lib/async-resilience"
import { PropositionVoteButton } from "@/components/proposition-vote-button"
import { usePropositionVote } from "@/hooks/use-proposition-vote"

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
      const result = await runToggleVote()
      if (!result.ok) {
        const description =
          result.status === 401
            ? tVote("loginRequiredBody")
            : result.error ?? tVote("voteFailedTitle")
        if (result.status === 401) {
          showToast({
            variant: "info",
            title: tVote("loginRequiredTitle"),
            description,
          })
          return
        }
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
          ? "Request timed out. Please try again."
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
        ariaLabel={hasVoted ? tVote("voteRecordedTitle") : tCommon("vote")}
      />
    </div>
  )
}