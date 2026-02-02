"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import debounce from "lodash/debounce"

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

  useEffect(() => {
    setQuery(initialQuery)
    setStatus(initialStatus)
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
  }

  const debouncedQueryUpdate = useMemo(
    () =>
      debounce((value: string) => {
        updateUrl({ q: value })
      }, 300),
    [pathname, searchParams]
  )

  useEffect(() => {
    debouncedQueryUpdate(query)
    return () => debouncedQueryUpdate.cancel()
  }, [debouncedQueryUpdate, query])

  return (
    <div className="flex flex-col gap-3 py-4 md:flex-row md:items-end md:justify-between">
      <div className="flex-1 space-y-2">
        <div className="flex w-full flex-wrap gap-2">
          <input
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Chercher une proposition ou une page..."
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:max-w-sm"
          />
          <input type="hidden" name="status" value={status.join(",")} />
          <div className="flex flex-wrap gap-3">
            {[
              { value: "Open", label: "Open" },
              { value: "In Progress", label: "In Progress" },
              { value: "Done", label: "Done" },
              { value: "Won't Do", label: "Won't Do" },
            ].map((option) => {
              const checked = status.includes(option.value)
              return (
                <label
                  key={option.value}
                  className="inline-flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const nextStatus = checked
                        ? status.filter((value) => value !== option.value)
                        : [...status, option.value]
                      setStatus(nextStatus)
                      updateUrl({
                        status: nextStatus.length ? nextStatus.join(",") : "",
                      })
                    }}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span>{option.label}</span>
                </label>
              )
            })}
          </div>
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="order" value={order} />
          <input type="hidden" name="range" value={range} />
        </div>
      </div>
    </div>
  )
}
