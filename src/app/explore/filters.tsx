"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import debounce from "lodash/debounce"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Props = {
  initialQuery: string
  initialStatusValue: string
  initialSort: string
  initialRange: string
  initialOrder: string
  initialPageSort: string
  initialPageOrder: string
  initialStatusOrder: string
}

const STATUS_OPTIONS = [
  { value: "all", label: "Tous les statuts" },
  { value: "Open", label: "Ouvert" },
  { value: "In Progress", label: "En cours" },
  { value: "Done", label: "Terminé" },
  { value: "Won't Do", label: "Ne sera pas fait" },
]

export default function ExploreFilters({
  initialQuery,
  initialStatusValue,
  initialSort,
  initialRange,
  initialOrder,
  initialPageSort,
  initialPageOrder,
  initialStatusOrder,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery)
  const [statusValue, setStatusValue] = useState(initialStatusValue)
  const prevInitialQueryRef = useRef(initialQuery)

  useEffect(() => {
    if (initialQuery !== prevInitialQueryRef.current) {
      prevInitialQueryRef.current = initialQuery
      setQuery(initialQuery)
    }
    setStatusValue(initialStatusValue)
  }, [initialQuery, initialStatusValue])

  const updateUrl = (next: {
    q?: string
    status?: string
    sort?: string
    range?: string
    order?: string
    pageSort?: string
    pageOrder?: string
    statusOrder?: string
  }) => {
    const params = new URLSearchParams(searchParams?.toString())
    if (next.q !== undefined) {
      next.q ? params.set("q", next.q) : params.delete("q")
    }
    if (next.status !== undefined) {
      next.status && next.status !== "all"
        ? params.set("status", next.status)
        : params.delete("status")
    }
    if (next.sort !== undefined) {
      next.sort ? params.set("sort", next.sort) : params.delete("sort")
    }
    if (next.range !== undefined) {
      next.range && next.range !== "all"
        ? params.set("range", next.range)
        : params.delete("range")
    }
    if (next.order !== undefined) {
      next.order && next.order !== "desc"
        ? params.set("order", next.order)
        : params.delete("order")
    }
    if (next.pageSort !== undefined) {
      next.pageSort && next.pageSort !== "none"
        ? params.set("pageSort", next.pageSort)
        : params.delete("pageSort")
    }
    if (next.pageOrder !== undefined) {
      next.pageOrder && next.pageOrder !== "asc"
        ? params.set("pageOrder", next.pageOrder)
        : params.delete("pageOrder")
    }
    if (next.statusOrder !== undefined) {
      next.statusOrder && next.statusOrder !== "asc"
        ? params.set("statusOrder", next.statusOrder)
        : params.delete("statusOrder")
    }

    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname)
    router.refresh()
  }

  const debouncedQueryUpdate = useMemo(
    () =>
      debounce((value: string) => {
        updateUrl({ q: value })
        prevInitialQueryRef.current = value
      }, 400),
    [pathname, searchParams]
  )

  useEffect(() => {
    debouncedQueryUpdate(query)
    return () => debouncedQueryUpdate.cancel()
  }, [debouncedQueryUpdate, query])

  const handleStatusChange = (value: string) => {
    setStatusValue(value)
    updateUrl({ status: value === "all" ? "" : value })
  }

  return (
    <div className="flex flex-col gap-3 px-4 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex w-full flex-wrap gap-2">
        <Input
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Chercher une proposition"
          className="h-10 w-full md:max-w-sm"
        />
        <Select value={statusValue} onValueChange={handleStatusChange}>
          <SelectTrigger className="h-10 w-full md:w-48">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <input type="hidden" name="sort" value={initialSort} />
      <input type="hidden" name="order" value={initialOrder} />
      <input type="hidden" name="range" value={initialRange} />
    </div>
  )
}
