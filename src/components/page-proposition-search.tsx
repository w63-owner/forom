"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  const [statusValue, setStatusValue] = useState(status ?? "all")
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    setValue(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    setStatusValue(status ?? "all")
  }, [status])


  const params = useMemo(() => {
    const next = new URLSearchParams()
    if (value.trim()) next.set("q", value.trim())
    if (statusValue && statusValue !== "all") next.set("status", statusValue)
    if (sort) next.set("sort", sort)
    if (statusSort) next.set("statusSort", statusSort)
    if (statusOrder) next.set("statusOrder", statusOrder)
    if (tab) next.set("tab", tab)
    return next
  }, [sort, statusOrder, statusSort, tab, value, statusValue])

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
    <div className="flex w-full flex-wrap gap-2">
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
      <Select value={statusValue} onValueChange={setStatusValue}>
        <SelectTrigger className="h-10 w-full md:w-48">
          <SelectValue placeholder="Statut" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les statuts</SelectItem>
          <SelectItem value="Open">Ouvert</SelectItem>
          <SelectItem value="In Progress">En cours</SelectItem>
          <SelectItem value="Done">Terminé</SelectItem>
          <SelectItem value="Won't Do">Ne sera pas fait</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
