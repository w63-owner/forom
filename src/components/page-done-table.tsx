"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { getSupabaseClient } from "@/utils/supabase/client"

type DoneItem = {
  id: string
  title: string
  created_at: string | null
}

type Props = {
  pageId: string
  initialItems: DoneItem[]
}

export function PageDoneTable({ pageId, initialItems }: Props) {
  const [items, setItems] = useState<DoneItem[]>(initialItems)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialItems.length >= 20)

  useEffect(() => {
    setItems(initialItems)
    setHasMore(initialItems.length >= 20)
  }, [initialItems])

  const loadMore = async () => {
    if (loadingMore || !hasMore) return
    const supabase = getSupabaseClient()
    if (!supabase) return

    setLoadingMore(true)
    const { data, error } = await supabase
      .from("propositions")
      .select("id, title, created_at")
      .eq("page_id", pageId)
      .eq("status", "Done")
      .order("created_at", { ascending: false })
      .range(items.length, items.length + 19)

    if (error) {
      setLoadingMore(false)
      return
    }

    const newItems = (data ?? []) as DoneItem[]
    if (newItems.length === 0) {
      setHasMore(false)
      setLoadingMore(false)
      return
    }

    setItems((prev) => [...prev, ...newItems])
    if (newItems.length < 20) {
      setHasMore(false)
    }
    setLoadingMore(false)
  }

  if (items.length === 0) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Proposition</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={3}
                className="px-4 py-6 text-center text-muted-foreground"
              >
                Aucun changement terminé pour le moment.
              </td>
            </tr>
          </tbody>
        </table>
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
            <th className="px-4 py-3 text-left font-medium">Date</th>
            <th className="px-4 py-3 text-right font-medium">Statut</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-t border-border transition-colors duration-150 hover:bg-muted/30"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/propositions/${item.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {item.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {item.created_at
                  ? new Date(item.created_at).toLocaleDateString("fr-FR")
                  : "—"}
              </td>
              <td className="px-4 py-3 text-right">
                <Badge variant="secondary">Done</Badge>
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

