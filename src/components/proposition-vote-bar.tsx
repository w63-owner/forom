"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { AsyncTimeoutError } from "@/lib/async-resilience"
import { PropositionVoteButton } from "@/components/proposition-vote-button"
import { usePropositionVote } from "@/hooks/use-proposition-vote"
import { getSupabaseClient } from "@/utils/supabase/client"
import { useToast } from "@/components/ui/toast"
import { ensureFreshSession } from "@/lib/auth/ensure-fresh-session"

type Props = {
  propositionId: string
  initialVotes: number
  initialHasVoted?: boolean
  propositionPageId: string | null
}

export function PropositionVoteBar({
  propositionId,
  initialVotes,
  initialHasVoted,
  propositionPageId,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useTranslations("PropositionVotes")
  const tCommon = useTranslations("Common")
  const locale = useLocale()
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()
  const [ownerNotifyDaily, setOwnerNotifyDaily] = useState(false)
  const [ownerVoteThreshold, setOwnerVoteThreshold] = useState<number | null>(
    null
  )
  const {
    votes,
    hasVoted,
    loading,
    ready,
    toggleVote: runToggleVote,
  } = usePropositionVote({
    propositionId,
    initialVotes,
    // Trust server value only when it is explicitly true.
    // "false" can be uncertain with transient auth/cookie issues during SSR.
    initialHasVoted: initialHasVoted === true ? true : undefined,
  })

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

  const handleVote = async () => {
    setError(null)
    const previousVotes = votes
    try {
      const supabase = getSupabaseClient()
      if (supabase) {
        const session = await ensureFreshSession(supabase)
        if (!session.ok) {
          if (session.kind === "unauthenticated") {
            const currentPath = `${pathname || `/${locale}`}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
            const nextParams = new URLSearchParams(searchParams.toString())
            nextParams.set("auth", "signup")
            nextParams.set("next", currentPath)
            showToast({
              variant: "warning",
              title: tCommon("loginRequiredTitle"),
              description: t("loginRequired"),
            })
            router.replace(`${pathname || `/${locale}`}?${nextParams.toString()}`)
            return
          }
          if (session.kind === "transient") {
            const description = t("sessionTransient")
            setError(description)
            showToast({
              variant: "warning",
              title: tCommon("sessionReconnectingTitle"),
              description,
            })
            return
          }
        }
      }
      const result = await runToggleVote()
      if (!result.ok) {
        if (result.status === 401) {
          const currentPath = `${pathname || `/${locale}`}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
          const nextParams = new URLSearchParams(searchParams.toString())
          nextParams.set("auth", "signup")
          nextParams.set("next", currentPath)
          showToast({
            variant: "warning",
            title: tCommon("loginRequiredTitle"),
            description: t("loginRequired"),
          })
          router.replace(`${pathname || `/${locale}`}?${nextParams.toString()}`)
          return
        }
        if (result.status === 403) {
          const description = t("permissionDenied")
          setError(description)
          showToast({
            variant: "warning",
            title: tCommon("permissionDeniedTitle"),
            description,
          })
          return
        }

        const description =
          result.error ?? t("voteFailedTitle")
        setError(description)
        showToast({
          variant: "error",
          title: t("voteFailedTitle"),
          description,
        })
      } else {
        const nextHasVoted = result.hasVoted
        const nextVotes = result.votes
        if (
          nextHasVoted &&
          propositionPageId &&
          !ownerNotifyDaily &&
          ownerVoteThreshold != null &&
          typeof nextVotes === "number" &&
          previousVotes < ownerVoteThreshold &&
          nextVotes >= ownerVoteThreshold
        ) {
          fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "owner_vote_threshold",
              propositionId,
              locale,
            }),
          }).catch(() => null)
        }
        showToast({
          variant: nextHasVoted ? "success" : "info",
          title: nextHasVoted ? t("upvoteRecorded") : t("voteRemovedTitle"),
        })
      }
    } catch (caughtError) {
      const description =
        caughtError instanceof AsyncTimeoutError
          ? t("voteTimeout")
          : caughtError instanceof Error
            ? caughtError.message
            : undefined
      setError(description ?? t("voteFailedTitle"))
      showToast({
        variant: "error",
        title: t("voteFailedTitle"),
        description,
      })
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {!ready ? (
          <div
            aria-hidden="true"
            className="h-12 w-12 animate-pulse rounded-xl border-2 border-border/60 bg-muted/40 md:h-11 md:w-11"
          />
        ) : (
          <PropositionVoteButton
            votes={votes}
            hasVoted={hasVoted}
            loading={loading}
            onClick={handleVote}
            ariaLabel={hasVoted ? t("voteRemovedTitle") : tCommon("vote")}
          />
        )}
      </div>
    </div>
  )
}