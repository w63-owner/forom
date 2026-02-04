 "use client"

import { useEffect, useMemo, useState } from "react"
 import Link from "next/link"
 import { Badge } from "@/components/ui/badge"
 import { PageVoteToggle } from "@/components/page-vote-toggle"
 import { getSupabaseClient } from "@/utils/supabase/client"

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
 }: Props) {
   const [items, setItems] = useState<TopItem[]>(initialItems)
   const [loadingMore, setLoadingMore] = useState(false)
   const [hasMore, setHasMore] = useState(initialItems.length >= 20)
   const [pageIds, setPageIds] = useState<string[]>([])
  const [pageIdsLoaded, setPageIdsLoaded] = useState(false)

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
          const statusA = a.status ?? "Open"
          const statusB = b.status ?? "Open"
          const compare = statusA.localeCompare(statusB)
          return statusOrder === "asc" ? compare : -compare
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
    if (newItems.length < 20) {
       setHasMore(false)
     }
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
                <th className="px-4 py-3 text-left font-medium">Proposition</th>
                <th className="hidden px-4 py-3 text-left font-medium md:table-cell">Page</th>
                <th className="hidden px-4 py-3 text-left font-medium md:table-cell">Statut</th>
                <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Votes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-3">
                    <span>Aucun résultat pour le moment.</span>
                    <Link
                      href={createHref}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      + Ajouter une proposition
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
              <th className="px-4 py-3 text-left font-medium">Proposition</th>
              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">Page</th>
              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">Statut</th>
              <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Votes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const page = getPageMeta(item.pages)
              return (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <Link
                        href={`/propositions/${item.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {item.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:hidden">
                        {page?.name && page.slug ? (
                          <Badge variant="outline" asChild>
                            <Link href={`/pages/${page.slug}`}>{page.name}</Link>
                          </Badge>
                        ) : (
                          <span>—</span>
                        )}
                        <div className="flex h-7 items-center">
                          <Badge variant="outline">{item.status ?? "Open"}</Badge>
                        </div>
                        <div className="ml-auto flex h-7 shrink-0 items-center [&_span]:text-xs [&_button]:h-7 [&_button]:py-0.5">
                          <PageVoteToggle
                            propositionId={item.id}
                            initialVotes={item.votes_count ?? 0}
                          />
                        </div>
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
                    <Badge variant="outline">{item.status ?? "Open"}</Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-right md:table-cell">
                    <PageVoteToggle
                      propositionId={item.id}
                      initialVotes={item.votes_count ?? 0}
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
            {loadingMore ? "Chargement..." : "Voir plus"}
          </button>
        </div>
      )}
    </div>
  )
}

