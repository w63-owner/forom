"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { PageVoteToggle } from "@/components/page-vote-toggle"
import { getSupabaseClient } from "@/utils/supabase/client"

type PropositionItem = {
  id: string
  title: string | null
  status: string | null
  votes_count: number | null
}

type Props = {
  pageId: string
  initialItems: PropositionItem[]
  query: string
  status: string | null
  sort: "top" | "recent"
  statusSort: "none" | "status"
  statusOrder: "asc" | "desc"
}

export function PagePropositionsTable({
  pageId,
  initialItems,
  query,
  status,
  sort,
  statusSort,
  statusOrder,
}: Props) {
  const [items, setItems] = useState<PropositionItem[]>(initialItems)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialItems.length >= 20)

  useEffect(() => {
    setItems(initialItems)
    setHasMore(initialItems.length >= 20)
  }, [initialItems])

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
      items.length + 19
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
    if (newItems.length < 20) {
      setHasMore(false)
    }
    setLoadingMore(false)
  }

  if (items.length === 0 && !hasMore) {
    return (
      <div className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Proposition</th>
                <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Statut</th>
                <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Votes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center">
                  <Link
                    href={`/propositions/create?${new URLSearchParams({
                      ...(query ? { title: query } : {}),
                      page: pageId,
                    }).toString()}`}
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    + Ajouter une proposition
                  </Link>
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
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Proposition</th>
              <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Statut</th>
              <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Votes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-t border-border transition-colors duration-150 hover:bg-muted/30"
              >
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <Link
                      href={`/propositions/${item.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {item.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:hidden">
                      <Badge variant="outline">{item.status ?? "Open"}</Badge>
                      <span>{item.votes_count ?? 0} votes</span>
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-right md:table-cell">
                  <Badge variant="outline">{item.status ?? "Open"}</Badge>
                </td>
                <td className="hidden px-4 py-3 text-right md:table-cell">
                  <PageVoteToggle
                    propositionId={item.id}
                    initialVotes={item.votes_count ?? 0}
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
            {loadingMore ? "Chargement..." : "Voir plus"}
          </button>
        </div>
      )}
    </div>
  )
}

