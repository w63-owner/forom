"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import debounce from "lodash/debounce"
import { useTranslations } from "next-intl"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getCategoriesForUniverseFromCsv } from "@/lib/discover-categories"
import type { Universe } from "@/types/schema"

type Props = {
  universe: Universe
  initialQuery: string
  initialStatusValue: string
  initialCategoryValue: string
  initialSubCategoryValue: string
  initialSort: string
  initialRange: string
  initialOrder: string
}

const STATUS_OPTIONS = [
  { value: "all", key: "all" },
  { value: "Open", key: "open" },
  { value: "In Progress", key: "inProgress" },
  { value: "Done", key: "done" },
  { value: "Won't Do", key: "wontDo" },
] as const

const SORT_OPTIONS = [
  { value: "votes", key: "votes" },
  { value: "reactivity", key: "reactivity" },
] as const

export default function DiscoverFilters({
  universe,
  initialQuery,
  initialStatusValue,
  initialCategoryValue,
  initialSubCategoryValue,
  initialSort,
  initialRange,
  initialOrder,
}: Props) {
  const tDiscover = useTranslations("Discover")
  const tStatus = useTranslations("Status")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery)
  const [statusValue, setStatusValue] = useState(initialStatusValue)
  const [categoryValue, setCategoryValue] = useState(initialCategoryValue)
  const [subCategoryValue, setSubCategoryValue] = useState(initialSubCategoryValue)
  const categories = getCategoriesForUniverseFromCsv(universe)
  const subCategories =
    categoryValue && categoryValue !== "all"
      ? categories.find((c) => c.category === categoryValue)?.subCategories ?? []
      : []

  useEffect(() => {
    setStatusValue(initialStatusValue)
  }, [initialStatusValue])
  useEffect(() => {
    setCategoryValue(initialCategoryValue)
  }, [initialCategoryValue])
  useEffect(() => {
    setSubCategoryValue(initialSubCategoryValue)
  }, [initialSubCategoryValue])

  const updateUrl = useCallback(
    (next: {
      q?: string
      status?: string
      category?: string
      sub_category?: string
      sort?: string
      range?: string
      order?: string
    }) => {
      const params = new URLSearchParams(searchParams?.toString())
      if (next.q !== undefined) {
        if (next.q) params.set("q", next.q)
        else params.delete("q")
      }
      if (next.status !== undefined) {
        if (next.status && next.status !== "all") params.set("status", next.status)
        else params.delete("status")
      }
      if (next.category !== undefined) {
        if (next.category && next.category !== "all") params.set("category", next.category)
        else params.delete("category")
      }
      if (next.sub_category !== undefined) {
        if (next.sub_category && next.sub_category !== "all") params.set("sub_category", next.sub_category)
        else params.delete("sub_category")
      }
      if (next.sort !== undefined) {
        if (next.sort && next.sort !== "votes") params.set("sort", next.sort)
        else params.delete("sort")
      }
      if (next.range !== undefined) {
        if (next.range && next.range !== "all") params.set("range", next.range)
        else params.delete("range")
      }
      if (next.order !== undefined) {
        if (next.order && next.order !== "desc") params.set("order", next.order)
        else params.delete("order")
      }
      const queryString = params.toString()
      router.replace(queryString ? `${pathname}?${queryString}` : pathname)
    },
    [pathname, router, searchParams]
  )

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

  return (
    <div className="flex flex-col gap-3 px-4 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex w-full flex-wrap gap-2">
        <Input
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tDiscover("searchPlaceholder")}
          className="h-10 w-full md:max-w-sm"
        />
        <Select value={statusValue} onValueChange={(v) => {
          setStatusValue(v)
          updateUrl({ status: v === "all" ? "" : v })
        }}>
          <SelectTrigger className="h-10 w-full md:w-48">
            <SelectValue placeholder={tDiscover("statusPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {tStatus(opt.key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categories.length > 0 && (
          <Select value={categoryValue} onValueChange={(v) => {
            setCategoryValue(v)
            setSubCategoryValue("all")
            updateUrl({ category: v === "all" ? "" : v, sub_category: "" })
          }}>
            <SelectTrigger className="h-10 w-full md:w-48">
              <SelectValue placeholder={tDiscover("categoryPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tDiscover("categoryAll")}</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.category} value={cat.category}>
                  {cat.category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {subCategories.length > 0 && (
          <Select value={subCategoryValue} onValueChange={(v) => {
            setSubCategoryValue(v)
            updateUrl({ sub_category: v === "all" ? "" : v })
          }}>
            <SelectTrigger className="h-10 w-full md:w-48">
              <SelectValue placeholder={tDiscover("subCategoryPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tDiscover("subCategoryAll")}</SelectItem>
              {subCategories.map((sub) => (
                <SelectItem key={sub} value={sub}>
                  {sub}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={initialSort} onValueChange={(v) => updateUrl({ sort: v === "votes" ? "" : v })}>
          <SelectTrigger className="h-10 w-full md:w-48">
            <SelectValue placeholder={tDiscover("sortPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {tDiscover(`sort_${opt.key}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}