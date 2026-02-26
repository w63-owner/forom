"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AsyncTimeoutError,
  fetchWithTimeout,
  withRetry,
} from "@/lib/async-resilience"

type SourceTable = "propositions" | "comments" | "pages"

type BatchItem = {
  sourceId: string
  sourceTable: SourceTable
  fields: string[]
}

type BatchPayload = {
  ok?: boolean
  error?: string
  translations?: Record<string, Record<string, string>>
}

const isTransientError = (error: unknown) => {
  if (error instanceof AsyncTimeoutError) return true
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase()
    return msg.includes("fetch") || msg.includes("network")
  }
  return false
}

/**
 * Fetches batch translations for a list of items.
 * translationMap: Map<sourceId, Map<field, translatedText>>
 * Call fetchTranslations(newItems) when loading more items.
 */
export function useListTranslations(
  targetLang: string,
  initialTranslations?: Record<string, Record<string, string>>
) {
  const [translationMap, setTranslationMap] = useState<
    Map<string, Map<string, string>>
  >(() => {
    if (!initialTranslations) return new Map()
    const map = new Map<string, Map<string, string>>()
    for (const [id, fields] of Object.entries(initialTranslations)) {
      map.set(id, new Map(Object.entries(fields)))
    }
    return map
  })

  const inFlightRef = useRef(false)
  const pendingRef = useRef<BatchItem[]>([])
  const targetLangRef = useRef(targetLang)
  targetLangRef.current = targetLang

  const fetchTranslations = useCallback(async (items: BatchItem[]) => {
    if (items.length === 0) return
    if (inFlightRef.current) {
      pendingRef.current = [...pendingRef.current, ...items]
      return
    }

    inFlightRef.current = true
    try {
      const response = await withRetry(
        () =>
          fetchWithTimeout(
            "/api/translations/batch",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                items,
                targetLang: targetLangRef.current,
              }),
            },
            15_000
          ),
        { attempts: 2, delayMs: 300, shouldRetry: isTransientError }
      )

      const payload = (await response.json()) as BatchPayload
      if (!response.ok || !payload.ok || !payload.translations) return

      setTranslationMap((prev) => {
        const next = new Map(prev)
        for (const [id, fieldMap] of Object.entries(payload.translations ?? {})) {
          const existing = next.get(id) ?? new Map<string, string>()
          for (const [field, text] of Object.entries(fieldMap)) {
            existing.set(field, text)
          }
          next.set(id, existing)
        }
        return next
      })
    } catch {
      // Silently fail — original content will be shown as fallback
    } finally {
      inFlightRef.current = false
      if (pendingRef.current.length > 0) {
        const next = pendingRef.current
        pendingRef.current = []
        void fetchTranslations(next)
      }
    }
  }, [])

  const getTitle = useCallback(
    (id: string, originalTitle: string | null): string => {
      return translationMap.get(id)?.get("title") ?? originalTitle ?? ""
    },
    [translationMap]
  )

  const getField = useCallback(
    (id: string, field: string, fallback: string | null): string => {
      return translationMap.get(id)?.get(field) ?? fallback ?? ""
    },
    [translationMap]
  )

  return { translationMap, fetchTranslations, getTitle, getField }
}

/**
 * Convenience hook that auto-fetches translations for an initial list on mount,
 * and exposes fetchTranslations for pagination.
 * Pass initialTranslations (from server prefetch) to avoid a client-side flash.
 */
export function useAutoListTranslations<T extends { id: string }>(
  items: T[],
  targetLang: string,
  sourceTable: SourceTable,
  fields: string[],
  initialTranslations?: Record<string, Record<string, string>>
) {
  const { translationMap, fetchTranslations, getTitle, getField } =
    useListTranslations(targetLang, initialTranslations)

  const initialFetchedRef = useRef(false)

  useEffect(() => {
    if (initialFetchedRef.current) return
    if (items.length === 0) return
    initialFetchedRef.current = true

    // Only fetch items not already covered by server-side prefetch
    const prefetchedIds = new Set(Object.keys(initialTranslations ?? {}))
    const missing = items.filter((item) => !prefetchedIds.has(item.id))
    if (missing.length === 0) return

    const batchItems: BatchItem[] = missing.map((item) => ({
      sourceId: item.id,
      sourceTable,
      fields,
    }))
    void fetchTranslations(batchItems)
  }, [items, sourceTable, fields, fetchTranslations, initialTranslations])

  const fetchMoreTranslations = useCallback(
    (newItems: T[]) => {
      if (newItems.length === 0) return
      const batchItems: BatchItem[] = newItems.map((item) => ({
        sourceId: item.id,
        sourceTable,
        fields,
      }))
      void fetchTranslations(batchItems)
    },
    [fetchTranslations, sourceTable, fields]
  )

  return { translationMap, getTitle, getField, fetchMoreTranslations }
}
