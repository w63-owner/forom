 "use client"

 import { useEffect, useMemo, useRef, useState } from "react"
 import Link from "next/link"
 import { Badge } from "@/components/ui/badge"
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
   const sentinelRef = useRef<HTMLTableRowElement | null>(null)

   const sortItems = useMemo(
     () => (list: TopItem[]) => {
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

   useEffect(() => {
     if (!hasMore) return
     if (!sentinelRef.current) return

     const observer = new IntersectionObserver(
       (entries) => {
         const [entry] = entries
         if (entry.isIntersecting && !loadingMore) {
           void loadMore()
         }
       },
       {
         root: null,
         rootMargin: "200px",
         threshold: 0.1,
       }
     )

     observer.observe(sentinelRef.current)
     return () => observer.disconnect()
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [hasMore, loadingMore, items.length, pageIdsLoaded])

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

     const { data, error } = await topQuery.range(items.length, items.length + 9)
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
     if (newItems.length < 10) {
       setHasMore(false)
     }
     setLoadingMore(false)
   }

   if (items.length === 0 && !hasMore) {
     return (
       <div className="overflow-x-auto">
         <table className="w-full text-sm">
           <thead className="bg-muted/50 text-muted-foreground">
             <tr>
               <th className="px-4 py-3 text-left font-medium">Proposition</th>
               <th className="px-4 py-3 text-left font-medium">Page</th>
               <th className="px-4 py-3 text-left font-medium">Statut</th>
               <th className="px-4 py-3 text-right font-medium">Votes</th>
             </tr>
           </thead>
           <tbody>
             <tr>
               <td
                 colSpan={4}
                 className="px-4 py-6 text-center text-muted-foreground"
               >
                 Aucun résultat pour le moment.
               </td>
             </tr>
           </tbody>
         </table>
       </div>
     )
   }

   return (
     <div className="overflow-x-auto">
       <table className="w-full text-sm">
         <thead className="bg-muted/50 text-muted-foreground">
           <tr>
             <th className="px-4 py-3 text-left font-medium">Proposition</th>
             <th className="px-4 py-3 text-left font-medium">Page</th>
             <th className="px-4 py-3 text-left font-medium">Statut</th>
             <th className="px-4 py-3 text-right font-medium">Votes</th>
           </tr>
         </thead>
         <tbody>
           {items.map((item) => {
             const page = getPageMeta(item.pages)
             return (
               <tr key={item.id} className="border-t border-border">
                 <td className="px-4 py-3">
                   <Link
                     href={`/propositions/${item.id}`}
                     className="font-medium text-foreground hover:underline"
                   >
                     {item.title}
                   </Link>
                 </td>
                 <td className="px-4 py-3">
                   {page?.name && page.slug ? (
                     <Badge variant="outline" asChild>
                       <Link href={`/pages/${page.slug}`}>{page.name}</Link>
                     </Badge>
                   ) : (
                     <span className="text-xs text-muted-foreground">—</span>
                   )}
                 </td>
                 <td className="px-4 py-3">
                   <Badge variant="outline">{item.status ?? "Open"}</Badge>
                 </td>
                 <td className="px-4 py-3 text-right font-medium text-foreground">
                   {item.votes_count ?? 0}
                 </td>
               </tr>
             )
           })}
           {hasMore && (
             <tr ref={sentinelRef}>
               <td
                 colSpan={4}
                 className="px-4 py-3 text-center text-xs text-muted-foreground"
               >
                 {loadingMore ? "Chargement..." : "Faites défiler pour voir plus"}
               </td>
             </tr>
           )}
         </tbody>
       </table>
     </div>
   )
 }

