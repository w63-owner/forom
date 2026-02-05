"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import debounce from "lodash/debounce"
import { getSupabaseClient } from "@/utils/supabase/client"

export type PageResult = {
  id: string
  name: string
  slug: string
}

type UsePageSearchOptions = {
  initialPageId?: string
  initialPageName?: string
  enabled: boolean
}

export function usePageSearch({
  initialPageId = "",
  initialPageName = "",
  enabled,
}: UsePageSearchOptions) {
  const [query, setQuery] = useState(initialPageName)
  const [results, setResults] = useState<PageResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPage, setSelectedPage] = useState<PageResult | null>(null)
  const [initialLoaded, setInitialLoaded] = useState(!initialPageId.trim())
  const [touched, setTouched] = useState(false)

  const debouncedSearch = useMemo(
    () =>
      debounce(async (value: string) => {
        setLoading(true)
        setError(null)
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort("timeout"), 5000)
        try {
          const response = await fetch(
            `/api/pages/search?q=${encodeURIComponent(value.trim())}`,
            { signal: controller.signal }
          )
          const payload = (await response.json()) as {
            data?: PageResult[]
            error?: string
          }

          if (!response.ok || payload.error) {
            setError(payload.error ?? "Impossible de récupérer les pages.")
            setResults([])
          } else {
            setResults(payload.data ?? [])
          }
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            setError(null)
            setResults([])
          } else {
            setError("Impossible de récupérer les pages.")
            setResults([])
          }
        } finally {
          clearTimeout(timeout)
          setLoading(false)
        }
      }, 300),
    []
  )

  useEffect(() => {
    if (!initialPageId.trim() || initialLoaded) return
    const loadInitialPage = async () => {
      const supabase = getSupabaseClient()
      if (!supabase) {
        setQuery(initialPageName || initialPageId)
        if (initialPageId.trim()) {
          setSelectedPage({
            id: initialPageId.trim(),
            name: initialPageName || initialPageId,
            slug: "",
          })
        }
        setInitialLoaded(true)
        return
      }
      const { data } = await supabase
        .from("pages")
        .select("id, name, slug")
        .eq("id", initialPageId.trim())
        .maybeSingle()
      if (data) {
        setSelectedPage(data)
        setQuery(data.name)
      } else {
        setQuery(initialPageName || initialPageId)
        if (initialPageId.trim()) {
          setSelectedPage({
            id: initialPageId.trim(),
            name: initialPageName || initialPageId,
            slug: "",
          })
        }
      }
      setInitialLoaded(true)
    }
    void loadInitialPage()
  }, [initialPageId, initialPageName, initialLoaded])

  useEffect(() => {
    if (!enabled) return
    if (!touched) return
    if (!query.trim()) {
      debouncedSearch.cancel()
      setResults([])
      setError(null)
      setLoading(false)
      return
    }
    debouncedSearch(query)
    return () => debouncedSearch.cancel()
  }, [debouncedSearch, enabled, query, touched])

  useEffect(() => {
    if (enabled) return
    debouncedSearch.cancel()
    setResults([])
    setError(null)
    setLoading(false)
  }, [debouncedSearch, enabled])

  const onQueryChange = (value: string) => {
    setQuery(value)
    setSelectedPage(null)
    setTouched(true)
  }

  const clearResults = useCallback(() => {
    setResults([])
  }, [])

  return {
    query,
    setQuery: onQueryChange,
    results,
    loading,
    error,
    selectedPage,
    setSelectedPage,
    touched,
    setTouched,
    clearResults,
  }
}
