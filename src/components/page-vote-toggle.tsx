"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { useToast } from "@/components/ui/toast"
import { AsyncTimeoutError } from "@/lib/async-resilience"
import { PropositionVoteButton } from "@/components/proposition-vote-button"
import { usePropositionVote } from "@/hooks/use-proposition-vote"
import { ensureFreshSession } from "@/lib/auth/ensure-fresh-session"
import { getSupabaseClient } from "@/utils/supabase/client"
import { useAuthModal } from "@/components/auth-modal-provider"

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
  const pathname = usePathname()
  const tCommon = useTranslations("Common")
  const tVote = useTranslations("Vote")
  const { showToast } = useToast()
  const { openAuthModal } = useAuthModal()
  const toggleVoteRef = useRef<(() => void) | null>(null)
  const { votes, hasVoted, loading, toggleVote: runToggleVote } = usePropositionVote({
    propositionId,
    initialVotes,
    initialHasVoted,
    syncOnMount: false,
    syncOnVisibility: false,
  })

  const currentPath = pathname || "/"

  const toggleVote = async () => {
    try {
      const supabase = getSupabaseClient()
      if (supabase) {
        const session = await ensureFreshSession(supabase)
        if (!session.ok) {
          if (session.kind === "unauthenticated") {
            showToast({
              variant: "warning",
              title: tVote("loginRequiredTitle"),
              description: tVote("loginRequiredBody"),
            })
            openAuthModal("signup", currentPath, () => toggleVoteRef.current?.())
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
          showToast({
            variant: "warning",
            title: tVote("loginRequiredTitle"),
            description: tVote("loginRequiredBody"),
          })
          openAuthModal("signup", currentPath, () => toggleVoteRef.current?.())
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

  useEffect(() => {
    toggleVoteRef.current = toggleVote
  })

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