"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useAutoListTranslations } from "@/hooks/use-list-translations"
import { Badge } from "@/components/ui/badge"
import { PageVoteToggle } from "@/components/page-vote-toggle"
import {
  AsyncTimeoutError,
  fetchWithTimeout,
  withRetry,
} from "@/lib/async-resilience"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"
import {
  compareStatuses,
  getStatusKey,
  getStatusToneClass,
} from "@/lib/status-labels"

 type PageMeta = { name?: string | null; slug?: string | null }

 type TopItem = {
   id: string
   title: string | null
   status: string | null
   votes_count: number | null
   created_at: string | null
   pages?: PageMeta | PageMeta[] | null
 }

 type Props = {
   initialItems: TopItem[]
  initialVotedIds?: string[]
   query: string
   statusValues: string[]
   range: string
   sort: "recent" | "votes"
   order: "asc" | "desc"
   titleSort: "none" | "title"
   titleOrder: "asc" | "desc"
   pageSort: "none" | "name" | "status"
   pageOrder: "asc" | "desc"
   statusOrder: "asc" | "desc"
  initialTranslations?: Record<string, Record<string, string>>
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

 export function ExploreTopTable({
   initialItems,
  initialVotedIds,
   query,
   statusValues,
   range,
   sort,
   order,
   titleSort,
   titleOrder,
   pageSort,
   pageOrder,
   statusOrder,
  initialTranslations,
 }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const tExplore = useTranslations("Explore")
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
  const { getTitle, fetchMoreTranslations } = useAutoListTranslations(
    items,
    locale,
    "propositions",
    ["title"],
    initialTranslations
  )

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

  const sortItems = useMemo(
    () => (list: TopItem[]) => {
      // Aucun tri secondaire actif : on conserve l’ordre serveur.
      if (titleSort === "none" && pageSort === "none") {
        return list
      }
      return [...list].sort((a, b) => {
        if (titleSort === "title") {
          const titleA = a.title ?? ""
          const titleB = b.title ?? ""
          const compare = titleA.localeCompare(titleB)
          return titleOrder === "asc" ? compare : -compare
        }
        if (pageSort === "name") {
          const nameA = getPageMeta(a.pages)?.name ?? ""
          const nameB = getPageMeta(b.pages)?.name ?? ""
          const compare = nameA.localeCompare(nameB)
          return pageOrder === "asc" ? compare : -compare
        }
        if (pageSort === "status") {
          return compareStatuses(a.status, b.status, statusOrder)
        }
        return 0
      })
    },
    [titleSort, titleOrder, pageSort, pageOrder, statusOrder]
  )

   useEffect(() => {
     setItems(initialItems)
     setHasMore(initialItems.length >= 20)
   }, [initialItems])

  useEffect(() => {
    setVotedIds(new Set(initialVotedIds ?? []))
  }, [initialVotedIds])

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
       setPageIds((data ?? []).map((item) => item.id))
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
     let topQuery = supabase
       .from("propositions")
       .select("id, title, status, votes_count, created_at, pages(name, slug)")

     if (statusValues.length > 0) {
       topQuery = topQuery.in("status", statusValues)
     }
     if (rangeStart) {
       topQuery = topQuery.gte("created_at", rangeStart.toISOString())
     }
     if (query) {
       if (pageIds.length > 0) {
         topQuery = topQuery.or(
           `title.ilike.%${query}%,page_id.in.(${pageIds.join(",")})`
         )
       } else {
         topQuery = topQuery.ilike("title", `%${query}%`)
       }
     }
     if (sort === "recent") {
       topQuery = topQuery.order("created_at", { ascending: false })
     } else {
       topQuery = topQuery.order("votes_count", { ascending: order === "asc" })
     }

    const { data, error } = await topQuery.range(items.length, items.length + 19)
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

     const merged = sortItems([...items, ...newItems])
     setItems(merged)
     fetchMoreTranslations(newItems)
    if (newItems.length < 20) {
       setHasMore(false)
     }
     setLoadingMore(false)
   }

  const guardCreate = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (user) return
    event.preventDefault()
    const currentPath = `${pathname || "/"}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set("auth", "signup")
    nextParams.set("next", currentPath)
    router.replace(`${pathname || "/"}?${nextParams.toString()}`)
  }

  if (items.length === 0 && !hasMore) {
    const createHref = query
      ? `/${locale}/propositions/create?title=${encodeURIComponent(query)}`
      : `/${locale}/propositions/create`
    return (
      <div className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="hidden bg-muted/50 text-muted-foreground md:table-header-group">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  {tExplore("columnProposition")}
                </th>
                <th className="hidden px-4 py-3 text-left font-medium md:table-cell">
                  {tExplore("columnPage")}
                </th>
                <th className="hidden px-4 py-3 text-left font-medium md:table-cell">
                  {tExplore("columnStatus")}
                </th>
                <th className="hidden px-4 py-3 text-right font-medium md:table-cell">
                  {tExplore("columnVotes")}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-3">
                    <span>{tExplore("noResultsTop")}</span>
                    <Link
                      href={createHref}
                      onClick={(event) => {
                        void guardCreate(event)
                      }}
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
                {tExplore("columnProposition")}
              </th>
              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">
                {tExplore("columnPage")}
              </th>
              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">
                {tExplore("columnStatus")}
              </th>
              <th className="hidden px-4 py-3 text-right font-medium md:table-cell">
                {tExplore("columnVotes")}
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
                        {getTitle(item.id, item.title)}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between gap-3 md:hidden">
                      <div className="min-w-0 space-y-2">
                        <Link
                          href={`/propositions/${item.id}`}
                          className="block font-medium text-foreground hover:underline"
                        >
                          {getTitle(item.id, item.title)}
                        </Link>
                        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {page?.name && page.slug ? (
                            <Badge variant="outline" asChild>
                              <Link href={`/pages/${page.slug}`}>{page.name}</Link>
                            </Badge>
                          ) : (
                            <span>—</span>
                          )}
                          <div className="flex h-7 items-center">
                            <Badge
                              variant="outline"
                              className={getStatusToneClass(item.status)}
                            >
                              {tStatus(getStatusKey(item.status))}
                            </Badge>
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
                    <Badge
                      variant="outline"
                      className={getStatusToneClass(item.status)}
                    >
                      {tStatus(getStatusKey(item.status))}
                    </Badge>
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
