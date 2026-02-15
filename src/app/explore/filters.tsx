"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { useTranslations } from "next-intl"

type Props = {
  initialQuery: string
  initialStatusValue: string
  initialSort: string
  initialRange: string
  initialOrder: string
}

export default function ExploreFilters({
  initialQuery,
  initialStatusValue,
  initialSort,
  initialRange,
  initialOrder,
}: Props) {
  const tExplore = useTranslations("Explore")
  const tStatus = useTranslations("Status")

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery)
  const [statusValue, setStatusValue] = useState(initialStatusValue)

  // Ne pas resynchroniser query depuis initialQuery : après notre debounce,
  // le re-render renverrait l’ancienne valeur et effacerait la frappe en cours.
  useEffect(() => {
    setStatusValue(initialStatusValue)
  }, [initialStatusValue])

  const statusOptions = useMemo(
    () => [
      { value: "all", label: tStatus("all") },
      { value: "Open", label: tStatus("open") },
      { value: "In Progress", label: tStatus("inProgress") },
      { value: "Done", label: tStatus("done") },
      { value: "Won't Do", label: tStatus("wontDo") },
    ],
    [tStatus]
  )

  const updateUrl = useCallback((next: {
    q?: string
    status?: string
    sort?: string
    range?: string
    order?: string
  }) => {
    const params = new URLSearchParams(searchParams?.toString())
    if (next.q !== undefined) {
      if (next.q) {
        params.set("q", next.q)
      } else {
        params.delete("q")
      }
    }
    if (next.status !== undefined) {
      if (next.status && next.status !== "all") {
        params.set("status", next.status)
      } else {
        params.delete("status")
      }
    }
    if (next.sort !== undefined) {
      if (next.sort) {
        params.set("sort", next.sort)
      } else {
        params.delete("sort")
      }
    }
    if (next.range !== undefined) {
      if (next.range && next.range !== "all") {
        params.set("range", next.range)
      } else {
        params.delete("range")
      }
    }
    if (next.order !== undefined) {
      if (next.order && next.order !== "desc") {
        params.set("order", next.order)
      } else {
        params.delete("order")
      }
    }

    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname)
  }, [pathname, router, searchParams])

  const debouncedQueryUpdateRef = useRef<ReturnType<typeof debounce> | null>(null)

  useEffect(() => {
    debouncedQueryUpdateRef.current = debounce((value: string) => {
      updateUrl({ q: value })
    }, 400)
    return () => debouncedQueryUpdateRef.current?.cancel()
  }, [updateUrl])

  useEffect(() => {
    debouncedQueryUpdateRef.current?.(query)
    return () => debouncedQueryUpdateRef.current?.cancel()
  }, [query])

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
          placeholder={tExplore("searchPlaceholder")}
          className="h-10 w-full md:max-w-sm"
        />
        <Select value={statusValue} onValueChange={handleStatusChange}>
          <SelectTrigger className="h-10 w-full md:w-48">
            <SelectValue placeholder={tExplore("statusPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((opt) => (
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