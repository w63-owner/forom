"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AsyncTimeoutError,
  fetchWithTimeout,
  withRetry,
} from "@/lib/async-resilience"

type UsePropositionVoteOptions = {
  propositionId: string
  initialVotes: number
  initialHasVoted?: boolean
  syncOnMount?: boolean
  syncOnVisibility?: boolean
}

type VoteBroadcastPayload = {
  propositionId: string
  hasVoted: boolean
  votes: number
  source: string
  timestamp: number
}

type VoteStatePayload = {
  ok?: boolean
  votedIds?: string[]
  voteCountsById?: Record<string, number>
}

type ToggleVotePayload = {
  ok?: boolean
  error?: string
  hasVoted?: boolean
  votes?: number
}

type ToggleResult =
  | { ok: true; hasVoted: boolean; votes: number }
  | { ok: false; status: number; error?: string }

const isTransientError = (error: unknown) => {
  if (error instanceof AsyncTimeoutError) return true
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase()
    return message.includes("fetch") || message.includes("network")
  }
  return false
}

const VOTE_BROADCAST_CHANNEL = "forom:vote-state"
const VOTE_STORAGE_EVENT_KEY = "forom:vote-state-event"

export function usePropositionVote({
  propositionId,
  initialVotes,
  initialHasVoted,
  syncOnMount = true,
  syncOnVisibility = true,
}: UsePropositionVoteOptions) {
  const sourceId = useMemo(
    () => `vote-${Math.random().toString(36).slice(2, 10)}`,
    []
  )
  const [votes, setVotes] = useState(initialVotes)
  const [hasVoted, setHasVoted] = useState(Boolean(initialHasVoted))
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(
    typeof initialHasVoted === "boolean" || !syncOnMount
  )
  const broadcastVoteState = useCallback(
    (nextHasVoted: boolean, nextVotes: number) => {
      if (typeof window === "undefined") return
      const payload: VoteBroadcastPayload = {
        propositionId,
        hasVoted: nextHasVoted,
        votes: nextVotes,
        source: sourceId,
        timestamp: Date.now(),
      }
      try {
        const channel = new BroadcastChannel(VOTE_BROADCAST_CHANNEL)
        channel.postMessage(payload)
        channel.close()
      } catch {
        // BroadcastChannel is not available in all browsers.
      }
      try {
        window.localStorage.setItem(VOTE_STORAGE_EVENT_KEY, JSON.stringify(payload))
      } catch {
        // Ignore localStorage errors in private mode or restrictive contexts.
      }
    },
    [propositionId, sourceId]
  )

  const applyVoteState = useCallback(
    (
      nextHasVoted: boolean,
      nextVotes: number,
      options?: { broadcast?: boolean }
    ) => {
      setHasVoted(nextHasVoted)
      setVotes(nextVotes)
      if (options?.broadcast) {
        broadcastVoteState(nextHasVoted, nextVotes)
      }
    },
    [broadcastVoteState]
  )

  useEffect(() => {
    setVotes(initialVotes)
  }, [propositionId, initialVotes])

  useEffect(() => {
    setReady(typeof initialHasVoted === "boolean" || !syncOnMount)
  }, [initialHasVoted, propositionId, syncOnMount])

  useEffect(() => {
    if (typeof initialHasVoted === "boolean") {
      applyVoteState(initialHasVoted, initialVotes)
      setReady(true)
    }
  }, [applyVoteState, initialHasVoted, initialVotes, propositionId])

  const syncFromState = useCallback(async () => {
    const response = await withRetry(
      () =>
        fetchWithTimeout(
          `/api/votes/state?ids=${encodeURIComponent(propositionId)}`,
          { cache: "no-store" },
          8000
        ),
      {
        attempts: 2,
        delayMs: 200,
        shouldRetry: isTransientError,
      }
    )
    if (response.status === 401) {
      setReady(true)
      return
    }
    if (!response.ok) {
      setReady(true)
      return
    }
    const payload = (await response.json()) as VoteStatePayload
    if (!payload.ok) {
      setReady(true)
      return
    }
    const nextHasVoted = (payload.votedIds ?? []).includes(propositionId)
    const nextVotes = payload.voteCountsById?.[propositionId]
    if (typeof nextVotes === "number") {
      applyVoteState(nextHasVoted, nextVotes)
      setReady(true)
      return
    }
    setHasVoted(nextHasVoted)
    setReady(true)
  }, [applyVoteState, propositionId])

  useEffect(() => {
    if (!syncOnMount) return
    void syncFromState().catch(() => {
      setReady(true)
      return null
    })
  }, [syncOnMount, syncFromState])

  useEffect(() => {
    if (!syncOnVisibility) return
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      void syncFromState().catch(() => null)
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [syncOnVisibility, syncFromState])

  useEffect(() => {
    if (typeof window === "undefined") return
    const applyExternalPayload = (payload: VoteBroadcastPayload) => {
      if (!payload || payload.source === sourceId) return
      if (payload.propositionId !== propositionId) return
      applyVoteState(payload.hasVoted, payload.votes)
    }
    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel(VOTE_BROADCAST_CHANNEL)
      channel.onmessage = (event: MessageEvent<VoteBroadcastPayload>) => {
        applyExternalPayload(event.data)
      }
    } catch {
      channel = null
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== VOTE_STORAGE_EVENT_KEY || !event.newValue) return
      try {
        const payload = JSON.parse(event.newValue) as VoteBroadcastPayload
        applyExternalPayload(payload)
      } catch {
        // Ignore malformed payloads.
      }
    }
    window.addEventListener("storage", onStorage)
    return () => {
      if (channel) {
        channel.close()
      }
      window.removeEventListener("storage", onStorage)
    }
  }, [applyVoteState, propositionId, sourceId])

  const toggleVote = useCallback(async (): Promise<ToggleResult> => {
    if (loading) {
      return { ok: false, status: 409, error: "Vote already in progress." }
    }

    const prevVotes = votes
    const prevHasVoted = hasVoted
    const predictedHasVoted = !prevHasVoted
    const predictedVotes = prevHasVoted
      ? Math.max(prevVotes - 1, 0)
      : prevVotes + 1

    // Optimistic update: apply predicted state immediately
    applyVoteState(predictedHasVoted, predictedVotes, { broadcast: true })
    setLoading(true)

    try {
      const response = await withRetry(
        () =>
          fetchWithTimeout(
            "/api/votes/toggle",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ propositionId }),
            },
            8000
          ),
        {
          attempts: 2,
          delayMs: 200,
          shouldRetry: isTransientError,
        }
      )
      const payload = (await response.json().catch(() => null)) as
        | ToggleVotePayload
        | null

      if (!response.ok || !payload?.ok) {
        applyVoteState(prevHasVoted, prevVotes)
        return {
          ok: false,
          status: response.status,
          error: payload?.error,
        }
      }

      const nextHasVoted = Boolean(payload.hasVoted)
      const nextVotes =
        typeof payload.votes === "number"
          ? payload.votes
          : predictedVotes
      applyVoteState(nextHasVoted, nextVotes, { broadcast: true })
      return { ok: true, hasVoted: nextHasVoted, votes: nextVotes }
    } catch (err) {
      applyVoteState(prevHasVoted, prevVotes)
      const error =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Vote failed"
      return { ok: false, status: 500, error }
    } finally {
      setLoading(false)
    }
  }, [applyVoteState, hasVoted, loading, propositionId, votes])

  return useMemo(
    () => ({
      votes,
      hasVoted,
      loading,
      ready,
      setVotes,
      setHasVoted,
      syncFromState,
      toggleVote,
    }),
    [hasVoted, loading, ready, syncFromState, toggleVote, votes]
  )
}