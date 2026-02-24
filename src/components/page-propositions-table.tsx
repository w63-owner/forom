"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { PageVoteToggle } from "@/components/page-vote-toggle"
import { PropositionStatusBadge } from "@/components/proposition-status-badge"
import {
  AsyncTimeoutError,
  fetchWithTimeout,
  withRetry,
} from "@/lib/async-resilience"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"

type PropositionItem = {
  id: string
  title: string | null
  status: string | null
  votes_count: number | null
}

type Props = {
  pageId: string
  pageName?: string | null
  initialItems: PropositionItem[]
  initialVotedIds?: string[]
  query: string
  status: string | null
  sort: "top" | "recent"
  statusSort: "none" | "status"
  statusOrder: "asc" | "desc"
  pageSize?: number
  emptyStateText?: string
  emptyActionLabel?: string
  emptyActionHref?: string
  emptyActionOpenNewTab?: boolean
  itemLinkPrefix?: string
  itemLinkOpenNewTab?: boolean
  pageOwnerId?: string | null
  currentUserId?: string | null
}

export function PagePropositionsTable({
  pageId,
  pageName,
  initialItems,
  initialVotedIds,
  query,
  status,
  sort,
  statusSort,
  statusOrder,
  pageSize = 20,
  emptyStateText,
  emptyActionLabel,
  emptyActionHref,
  emptyActionOpenNewTab = false,
  itemLinkPrefix = "/propositions",
  itemLinkOpenNewTab = false,
  pageOwnerId = null,
  currentUserId = null,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const tCommon = useTranslations("Common")
  const [items, setItems] = useState<PropositionItem[]>(initialItems)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialItems.length >= pageSize)
  const [votedIds, setVotedIds] = useState<Set<string>>(
    new Set(initialVotedIds ?? [])
  )
  const [voteCountsById, setVoteCountsById] = useState<Record<string, number>>({})

  const loadVotedIds = async (propositionIds: string[]) => {
    if (propositionIds.length === 0) {
      setVotedIds(new Set())
      setVoteCountsById({})
      return
    }
    const response = await withRetry(
      () =>
        fetchWithTimeout(
          `/api/votes/state?ids=${encodeURIComponent(propositionIds.join(","))}`,
          { cache: "no-store" },
          8000
        ),
      {
        attempts: 2,
        delayMs: 200,
        shouldRetry: (error) => error instanceof AsyncTimeoutError,
      }
    )
    if (response.status === 401) {
      return
    }
    if (!response.ok) {
      throw new Error("votes_state_failed")
    }
    const payload = (await response.json()) as {
      ok?: boolean
      votedIds?: string[]
      voteCountsById?: Record<string, number>
    }
    setVotedIds(new Set(payload.votedIds ?? []))
    setVoteCountsById(payload.voteCountsById ?? {})
  }

  useEffect(() => {
    setItems(initialItems)
    setHasMore(initialItems.length >= pageSize)
  }, [initialItems, pageSize])

  useEffect(() => {
    setVotedIds(new Set(initialVotedIds ?? []))
  }, [initialVotedIds])

  const handleStatusChange = (propositionId: string, newStatus: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === propositionId ? { ...item, status: newStatus } : item
      )
    )
  }

  const handleVoteChange = ({
    propositionId,
    hasVoted,
    votes,
  }: {
    propositionId: string
    hasVoted: boolean
    votes: number
  }) => {
    setVotedIds((prev) => {
      const next = new Set(prev)
      if (hasVoted) next.add(propositionId)
      else next.delete(propositionId)
      return next
    })
    setVoteCountsById((prev) => ({ ...prev, [propositionId]: votes }))
  }

  useEffect(() => {
    let cancelled = false
    const loadVotes = async () => {
      try {
        const propositionIds = Array.from(new Set(items.map((item) => item.id)))
        await loadVotedIds(propositionIds)
        if (cancelled) return
      } catch {
        // Keep previous voted state on transient failures.
      }
    }
    void loadVotes()
    return () => {
      cancelled = true
    }
  }, [items])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      const propositionIds = Array.from(new Set(items.map((item) => item.id)))
      void loadVotedIds(propositionIds).catch(() => null)
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [items])

  const sortItems = useMemo(
    () => (list: PropositionItem[]) => {
      if (statusSort === "none") return list
      return [...list].sort((a, b) => {
        const statusA = a.status ?? "Open"
        const statusB = b.status ?? "Open"
        const compare = statusA.localeCompare(statusB)
        return statusOrder === "asc" ? compare : -compare
      })
    },
    [statusSort, statusOrder]
  )

  const loadMore = async () => {
    if (loadingMore || !hasMore) return
    const supabase = getSupabaseClient()
    if (!supabase) return

    setLoadingMore(true)
    let queryBuilder = supabase
      .from("propositions")
      .select("id, title, status, votes_count, created_at")
      .eq("page_id", pageId)

    if (status) {
      queryBuilder = queryBuilder.eq("status", status)
    }
    if (query) {
      queryBuilder = queryBuilder.ilike("title", `%${query}%`)
    }
    if (sort === "recent") {
      queryBuilder = queryBuilder.order("created_at", { ascending: false })
    } else {
      queryBuilder = queryBuilder.order("votes_count", { ascending: false })
    }

    const { data, error } = await queryBuilder.range(
      items.length,
      items.length + pageSize - 1
    )
    if (error) {
      setLoadingMore(false)
      return
    }

    const newItems = (data ?? []) as PropositionItem[]
    if (newItems.length === 0) {
      setHasMore(false)
      setLoadingMore(false)
      return
    }

    const merged = sortItems([...items, ...newItems])
    setItems(merged)
    if (newItems.length < pageSize) {
      setHasMore(false)
    }
    setLoadingMore(false)
  }

  const guardCreate = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 10000,
      includeServerFallback: true,
    })
    if (!user) {
      event.preventDefault()
      const currentPath = `${pathname || `/${locale}`}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.set("auth", "signup")
      nextParams.set("next", currentPath)
      router.replace(`${pathname || `/${locale}`}?${nextParams.toString()}`)
    }
  }

  if (items.length === 0 && !hasMore) {
    const isCustomEmptyAction = Boolean(emptyActionLabel && emptyActionHref)
    return (
      <div className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="hidden bg-muted/50 text-muted-foreground md:table-header-group">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{tCommon("proposition")}</th>
                <th className="hidden px-4 py-3 text-right font-medium md:table-cell">{tCommon("status")}</th>
                <th className="hidden px-4 py-3 text-right font-medium md:table-cell">{tCommon("votes")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      {emptyStateText ?? tCommon("searchOrAddProposition")}
                    </p>
                    {isCustomEmptyAction ? (
                      <a
                        href={emptyActionHref}
                        target={emptyActionOpenNewTab ? "_blank" : undefined}
                        rel={emptyActionOpenNewTab ? "noopener noreferrer" : undefined}
                        className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        {emptyActionLabel}
                      </a>
                    ) : (
                      <Link
                        href={`/propositions/create?${new URLSearchParams({
                          ...(query ? { title: query } : {}),
                          page: pageId,
                          ...(pageName ? { pageName: pageName } : {}),
                        }).toString()}`}
                        onClick={guardCreate}
                        className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        {tCommon("addProposition")}
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="hidden bg-muted/50 text-muted-foreground md:table-header-group">
            <tr>
              <th className="px-4 py-3 text-left font-medium">{tCommon("proposition")}</th>
              <th className="hidden px-4 py-3 text-right font-medium md:table-cell">{tCommon("status")}</th>
              <th className="hidden px-4 py-3 text-right font-medium md:table-cell">{tCommon("votes")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-t border-border transition-colors duration-150 hover:bg-muted/30"
              >
                <td className="px-4 py-3">
                  <div className="hidden space-y-2 md:block">
                    <Link
                      href={`${itemLinkPrefix}/${item.id}`}
                      target={itemLinkOpenNewTab ? "_blank" : undefined}
                      rel={itemLinkOpenNewTab ? "noopener noreferrer" : undefined}
                      className="font-medium text-foreground hover:underline"
                    >
                      {item.title}
                    </Link>
                  </div>
                  <div className="flex items-center justify-between gap-3 md:hidden">
                    <div className="min-w-0 space-y-2">
                      <Link
                        href={`${itemLinkPrefix}/${item.id}`}
                        target={itemLinkOpenNewTab ? "_blank" : undefined}
                        rel={itemLinkOpenNewTab ? "noopener noreferrer" : undefined}
                        className="block font-medium text-foreground hover:underline"
                      >
                        {item.title}
                      </Link>
                      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <div className="flex h-7 items-center">
                          <PropositionStatusBadge
                            propositionId={item.id}
                            initialStatus={item.status ?? "Open"}
                            pageOwnerId={pageOwnerId ?? null}
                            currentUserId={currentUserId}
                            onStatusChange={handleStatusChange}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <PageVoteToggle
                        propositionId={item.id}
                        initialVotes={voteCountsById[item.id] ?? (item.votes_count ?? 0)}
                        initialHasVoted={votedIds.has(item.id)}
                        onVoteChange={handleVoteChange}
                      />
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-right md:table-cell">
                  <PropositionStatusBadge
                    propositionId={item.id}
                    initialStatus={item.status ?? "Open"}
                    pageOwnerId={pageOwnerId ?? null}
                    currentUserId={currentUserId}
                    onStatusChange={handleStatusChange}
                  />
                </td>
                <td className="hidden px-4 py-3 text-right md:table-cell">
                  <PageVoteToggle
                    propositionId={item.id}
                    initialVotes={voteCountsById[item.id] ?? (item.votes_count ?? 0)}
                    initialHasVoted={votedIds.has(item.id)}
                    onVoteChange={handleVoteChange}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {loadingMore ? tCommon("loading") : tCommon("seeMore")}
          </button>
        </div>
      )}
    </div>
  )
}
