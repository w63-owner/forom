"use client"

import { useEffect, useState } from "react"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import { PageVoteToggle } from "@/components/page-vote-toggle"
import {
  AsyncTimeoutError,
  fetchWithTimeout,
  withRetry,
} from "@/lib/async-resilience"
import { getSupabaseClient } from "@/utils/supabase/client"
import { getStatusKey } from "@/lib/status-labels"
import { getCategoryI18nKey, getSubCategoryI18nKey } from "@/lib/discover-categories"
import type { Universe } from "@/types/schema"

type PageMeta = {
  name?: string | null
  slug?: string | null
  reactivity_score?: number | null
}

type TopItem = {
  id: string
  title: string | null
  status: string | null
  votes_count: number | null
  created_at: string | null
  category?: string | null
  sub_category?: string | null
  pages?: PageMeta | PageMeta[] | null
}

const getPageMeta = (
  pages: PageMeta[] | PageMeta | null | undefined
): PageMeta | null => {
  if (!pages) return null
  return Array.isArray(pages) ? pages[0] ?? null : pages
}

const getRangeStart = (range: string) => {
  const now = new Date()
  if (range === "week") {
    now.setDate(now.getDate() - 7)
    return now
  }
  if (range === "month") {
    now.setMonth(now.getMonth() - 1)
    return now
  }
  if (range === "year") {
    now.setFullYear(now.getFullYear() - 1)
    return now
  }
  return null
}

type Props = {
  initialItems: TopItem[]
  initialVotedIds?: string[]
  query: string
  statusValues: string[]
  categoryValue: string | null
  subCategoryValue: string | null
  range: string
  sort: "votes" | "reactivity"
  order: "asc" | "desc"
  universe: Universe
}

export function DiscoverPropositionsTable({
  initialItems,
  initialVotedIds,
  query,
  statusValues,
  categoryValue,
  subCategoryValue,
  range,
  sort,
  order,
  universe,
}: Props) {
  const tDiscover = useTranslations("Discover")
  const tCommon = useTranslations("Common")
  const tNav = useTranslations("Nav")
  const tStatus = useTranslations("Status")
  const [items, setItems] = useState<TopItem[]>(initialItems)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialItems.length >= 20)
  const [pageIds, setPageIds] = useState<string[]>([])
  const [pageIdsLoaded, setPageIdsLoaded] = useState(false)
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
    if (response.status === 401) return
    if (!response.ok) throw new Error("votes_state_failed")
    const payload = (await response.json()) as {
      ok?: boolean
      votedIds?: string[]
      voteCountsById?: Record<string, number>
    }
    setVotedIds(new Set(payload.votedIds ?? []))
    setVoteCountsById(payload.voteCountsById ?? {})
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
    setItems(initialItems)
    setHasMore(initialItems.length >= 20)
  }, [initialItems])

  useEffect(() => {
    setVotedIds(new Set(initialVotedIds ?? []))
  }, [initialVotedIds])

  useEffect(() => {
    let cancelled = false
    const loadVotes = async () => {
      try {
        const ids = Array.from(new Set(items.map((i) => i.id)))
        await loadVotedIds(ids)
        if (cancelled) return
      } catch {
        // keep previous state on transient failures
      }
    }
    void loadVotes()
    return () => {
      cancelled = true
    }
  }, [items])

  useEffect(() => {
    let isMounted = true
    const loadPageIds = async () => {
      if (!query) {
        setPageIds([])
        setPageIdsLoaded(true)
        return
      }
      const supabase = getSupabaseClient()
      if (!supabase) {
        setPageIds([])
        setPageIdsLoaded(true)
        return
      }
      const { data } = await supabase
        .from("pages")
        .select("id")
        .ilike("name", `%${query}%`)
        .limit(25)
      if (!isMounted) return
      setPageIds((data ?? []).map((i) => i.id))
      setPageIdsLoaded(true)
    }
    setPageIdsLoaded(false)
    void loadPageIds()
    return () => {
      isMounted = false
    }
  }, [query])

  const loadMore = async () => {
    if (loadingMore || !hasMore) return
    if (query && !pageIdsLoaded) return
    const supabase = getSupabaseClient()
    if (!supabase) return

    setLoadingMore(true)
    const rangeStart = getRangeStart(range)

    let propsQuery = supabase
      .from("propositions")
      .select("id, title, status, votes_count, created_at, category, sub_category, pages(name, slug, reactivity_score)")
      .eq("universe", universe)

    if (statusValues.length > 0) {
      propsQuery = propsQuery.in("status", statusValues)
    }
    if (categoryValue) {
      propsQuery = propsQuery.eq("category", categoryValue)
    }
    if (subCategoryValue) {
      propsQuery = propsQuery.eq("sub_category", subCategoryValue)
    }
    if (rangeStart) {
      propsQuery = propsQuery.gte("created_at", rangeStart.toISOString())
    }
    if (query) {
      if (pageIds.length > 0) {
        propsQuery = propsQuery.or(
          `title.ilike.%${query}%,page_id.in.(${pageIds.join(",")})`
        )
      } else {
        propsQuery = propsQuery.ilike("title", `%${query}%`)
      }
    }
    if (sort === "reactivity") {
      propsQuery = propsQuery.order("created_at", { ascending: false })
    } else {
      propsQuery = propsQuery.order("votes_count", {
        ascending: order === "asc",
      })
    }

    const { data, error } = await propsQuery.range(
      items.length,
      items.length + 19
    )
    if (error) {
      setLoadingMore(false)
      return
    }

    const newItems = (data ?? []) as TopItem[]
    if (newItems.length === 0) {
      setHasMore(false)
      setLoadingMore(false)
      return
    }

    let merged = [...items, ...newItems]
    if (sort === "reactivity") {
      merged = merged.sort((a, b) => {
        const pageA = getPageMeta(a.pages)
        const pageB = getPageMeta(b.pages)
        const scoreA = pageA?.reactivity_score ?? 0
        const scoreB = pageB?.reactivity_score ?? 0
        return order === "asc" ? scoreA - scoreB : scoreB - scoreA
      })
    }
    setItems(merged)
    if (newItems.length < 20) setHasMore(false)
    setLoadingMore(false)
  }

  if (items.length === 0 && !hasMore) {
    const createHref = query
      ? `/propositions/create?title=${encodeURIComponent(query)}`
      : "/propositions/create"
    return (
      <div className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="hidden bg-muted/50 text-muted-foreground md:table-header-group">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  {tDiscover("columnProposition")}
                </th>
                <th className="hidden px-4 py-3 text-left font-medium md:table-cell">
                  {tDiscover("columnPage")}
                </th>
                <th className="hidden px-4 py-3 text-left font-medium md:table-cell">
                  {tDiscover("columnCategory")}
                </th>
                <th className="hidden px-4 py-3 text-left font-medium md:table-cell">
                  {tDiscover("columnStatus")}
                </th>
                <th className="hidden px-4 py-3 text-right font-medium md:table-cell">
                  {tDiscover("columnVotes")}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-3">
                    <span>{tDiscover("noResults")}</span>
                    <Link
                      href={createHref}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      + {tNav("addProposition")}
                    </Link>
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
              <th className="px-4 py-3 text-left font-medium">
                {tDiscover("columnProposition")}
              </th>
              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">
                {tDiscover("columnPage")}
              </th>
              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">
                {tDiscover("columnCategory")}
              </th>
              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">
                {tDiscover("columnStatus")}
              </th>
              <th className="hidden px-4 py-3 text-right font-medium md:table-cell">
                {tDiscover("columnVotes")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const page = getPageMeta(item.pages)
              return (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="hidden space-y-2 md:block">
                      <Link
                        href={`/propositions/${item.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {item.title}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between gap-3 md:hidden">
                      <div className="min-w-0 space-y-2">
                        <Link
                          href={`/propositions/${item.id}`}
                          className="block font-medium text-foreground hover:underline"
                        >
                          {item.title}
                        </Link>
                        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {page?.name && page.slug ? (
                            <Badge variant="outline" asChild>
                              <Link href={`/pages/${page.slug}`}>{page.name}</Link>
                            </Badge>
                          ) : (
                            <span>—</span>
                          )}
                          {item.category && (() => {
                            const key = getCategoryI18nKey(item.category)
                            return key ? (
                              <Badge variant="secondary" className="font-normal">
                                {tDiscover(`category_${key}` as never)}
                              </Badge>
                            ) : null
                          })()}
                          <div className="flex h-7 items-center">
                            <Badge variant="outline">
                              {tStatus(getStatusKey(item.status))}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <PageVoteToggle
                          propositionId={item.id}
                          initialVotes={
                            voteCountsById[item.id] ?? (item.votes_count ?? 0)
                          }
                          initialHasVoted={votedIds.has(item.id)}
                          onVoteChange={handleVoteChange}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {page?.name && page.slug ? (
                      <Badge variant="outline" asChild>
                        <Link href={`/pages/${page.slug}`}>{page.name}</Link>
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {item.category && (() => {
                      const key = getCategoryI18nKey(item.category)
                      const subKey = item.sub_category
                        ? getSubCategoryI18nKey(item.category!, item.sub_category)
                        : null
                      const categoryLabel = key
                        ? (tDiscover(`category_${key}` as never) as string)
                        : item.category
                      const subLabel = subKey
                        ? (tDiscover(`subCategory_${subKey}` as never) as string)
                        : item.sub_category ?? null
                      return (
                        <span className="text-xs text-muted-foreground">
                          {categoryLabel}
                          {subLabel && <> / {subLabel}</>}
                        </span>
                      )
                    })()}
                    {!item.category && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <Badge variant="outline">
                      {tStatus(getStatusKey(item.status))}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-right md:table-cell">
                    <PageVoteToggle
                      propositionId={item.id}
                      initialVotes={
                        voteCountsById[item.id] ?? (item.votes_count ?? 0)
                      }
                      initialHasVoted={votedIds.has(item.id)}
                      onVoteChange={handleVoteChange}
                    />
                  </td>
                </tr>
              )
            })}
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