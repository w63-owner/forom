"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type Props = {
  slug: string
  initialQuery: string
  status: string | null
  sort: string
  statusSort: string | null
  statusOrder: string | null
  tab: "propositions" | "nouveautes"
}

export function PagePropositionSearch({
  slug,
  initialQuery,
  status,
  sort,
  statusSort,
  statusOrder,
  tab,
}: Props) {
  const router = useRouter()
  const [value, setValue] = useState(initialQuery)
  const debounceRef = useRef<number | null>(null)

  const params = useMemo(() => {
    const next = new URLSearchParams()
    if (value.trim()) next.set("q", value.trim())
    if (status) next.set("status", status)
    if (sort) next.set("sort", sort)
    if (statusSort) next.set("statusSort", statusSort)
    if (statusOrder) next.set("statusOrder", statusOrder)
    if (tab) next.set("tab", tab)
    return next
  }, [sort, status, statusOrder, statusSort, tab, value])

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
    }
    debounceRef.current = window.setTimeout(() => {
      const queryString = params.toString()
      router.replace(queryString ? `/pages/${slug}?${queryString}` : `/pages/${slug}`)
    }, 300)

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }
    }
  }, [params, router, slug])

  return (
    <input
      name="q"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder={
        tab === "nouveautes"
          ? "Chercher les nouveautés"
          : "Chercher ou créer une proposition..."
      }
      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:max-w-sm"
    />
  )
}
