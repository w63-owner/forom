"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import debounce from "lodash/debounce"
import { Input } from "@/components/ui/input"

type Props = {
  initialQuery: string
  initialStatus: string[]
  initialSort: string
  initialRange: string
  initialOrder: string
  initialPageSort: string
  initialPageOrder: string
  initialStatusOrder: string
}

export default function ExploreFilters({
  initialQuery,
  initialStatus,
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
  const [status, setStatus] = useState<string[]>(initialStatus)
  const [sort, setSort] = useState(initialSort)
  const [range, setRange] = useState(initialRange)
  const [order, setOrder] = useState(initialOrder)
  const [pageSort, setPageSort] = useState(initialPageSort)
  const [pageOrder, setPageOrder] = useState(initialPageOrder)
  const [statusOrder, setStatusOrder] = useState(initialStatusOrder)
  const prevInitialQueryRef = useRef(initialQuery)
  const expectedStatusRef = useRef<string[] | null>(null)

  useEffect(() => {
    if (initialQuery !== prevInitialQueryRef.current) {
      prevInitialQueryRef.current = initialQuery
      setQuery(initialQuery)
    }
    if (
      expectedStatusRef.current === null ||
      JSON.stringify(initialStatus) === JSON.stringify(expectedStatusRef.current)
    ) {
      setStatus(initialStatus)
      expectedStatusRef.current = null
    }
    setSort(initialSort)
    setRange(initialRange)
    setOrder(initialOrder)
    setPageSort(initialPageSort)
    setPageOrder(initialPageOrder)
    setStatusOrder(initialStatusOrder)
  }, [
    initialOrder,
    initialPageOrder,
    initialPageSort,
    initialQuery,
    initialRange,
    initialSort,
    initialStatus,
    initialStatusOrder,
  ])

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

  const statusOptions = [
    { value: "Open", label: "Ouvert" },
    { value: "In Progress", label: "En cours" },
    { value: "Done", label: "Terminé" },
    { value: "Won't Do", label: "Ne sera pas fait" },
  ]

  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <Input
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Chercher une proposition"
        className="h-10 flex-1 sm:min-w-0 sm:max-w-md"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="status" value={status.join(",")} />
        {statusOptions.map((option) => {
          const checked = status.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              role="checkbox"
              aria-checked={checked}
              onClick={() => {
                const nextStatus = checked
                  ? status.filter((value) => value !== option.value)
                  : [...status, option.value]
                expectedStatusRef.current = nextStatus
                setStatus(nextStatus)
                updateUrl({
                  status: nextStatus.length ? nextStatus.join(",") : "",
                })
              }}
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                checked
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      <input type="hidden" name="sort" value={sort} />
      <input type="hidden" name="order" value={order} />
      <input type="hidden" name="range" value={range} />
    </div>
  )
}
