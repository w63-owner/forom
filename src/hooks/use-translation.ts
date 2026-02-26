"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AsyncTimeoutError,
  fetchWithTimeout,
  withRetry,
} from "@/lib/async-resilience"

type SourceTable = "propositions" | "comments"

type UseTranslationOptions = {
  sourceTable: SourceTable
  sourceId: string
  fields: string[]
  targetLang: string
  /** If true, translation is fetched automatically on mount */
  autoTranslate?: boolean
}

type TranslationState = {
  translations: Record<string, string> | null
  loading: boolean
  error: string | null
  isShowingOriginal: boolean
}

type TranslationPayload = {
  ok?: boolean
  error?: string
  translations?: Record<string, string>
  cached?: boolean
}

const isTransientError = (error: unknown) => {
  if (error instanceof AsyncTimeoutError) return true
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase()
    return msg.includes("fetch") || msg.includes("network")
  }
  return false
}

export function useTranslation({
  sourceTable,
  sourceId,
  fields,
  targetLang,
  autoTranslate = false,
}: UseTranslationOptions) {
  const [state, setState] = useState<TranslationState>({
    translations: null,
    loading: false,
    error: null,
    isShowingOriginal: true,
  })

  const inFlightRef = useRef(false)

  const translate = useCallback(async () => {
    if (inFlightRef.current) return

    if (!state.isShowingOriginal && state.translations) {
      setState((prev) => ({ ...prev, isShowingOriginal: true }))
      return
    }

    if (state.translations) {
      setState((prev) => ({ ...prev, isShowingOriginal: false }))
      return
    }

    inFlightRef.current = true
    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const response = await withRetry(
        () =>
          fetchWithTimeout(
            "/api/translations",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sourceTable, sourceId, fields, targetLang }),
            },
            10_000
          ),
        { attempts: 2, delayMs: 300, shouldRetry: isTransientError }
      )

      const payload = (await response.json()) as TranslationPayload

      if (!response.ok || !payload.ok) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: payload.error ?? "Translation failed.",
        }))
        return
      }

      setState({
        translations: payload.translations ?? null,
        loading: false,
        error: null,
        isShowingOriginal: false,
      })
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Translation failed.",
      }))
    } finally {
      inFlightRef.current = false
    }
  }, [
    state.isShowingOriginal,
    state.translations,
    sourceTable,
    sourceId,
    fields,
    targetLang,
  ])

  // Auto-translate on mount when requested
  useEffect(() => {
    if (autoTranslate) void translate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reset = useCallback(() => {
    setState({
      translations: null,
      loading: false,
      error: null,
      isShowingOriginal: true,
    })
  }, [])

  return useMemo(
    () => ({
      ...state,
      translate,
      reset,
    }),
    [state, translate, reset]
  )
}
