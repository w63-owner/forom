"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { getSupabaseClient } from "@/utils/supabase/client"
import {
  AsyncTimeoutError,
  fetchWithTimeout,
  withRetry,
  withTimeoutPromise,
} from "@/lib/async-resilience"

export type NotificationItem = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  created_at: string
  read_at: string | null
}

type UseNotificationsResult = {
  notifications: NotificationItem[] | null
  unreadCount: number
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  markRead: (ids: string[]) => Promise<void>
  markAllRead: () => Promise<void>
}

export function useNotifications(email: string | null): UseNotificationsResult {
  const t = useTranslations("Auth")
  const [notifications, setNotifications] = useState<NotificationItem[] | null>(
    null
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const safeSet = useCallback((fn: () => void) => {
    if (isMountedRef.current) {
      fn()
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!email) {
      safeSet(() => {
        setLoading(false)
        setNotifications([])
        setError(null)
      })
      return
    }
    safeSet(() => {
      setLoading(true)
      setError(null)
    })
    try {
      const response = await withRetry(
        () => fetchWithTimeout("/api/notifications", { cache: "no-store" }, 8000),
        {
          attempts: 2,
          delayMs: 300,
          shouldRetry: (error) => error instanceof AsyncTimeoutError,
        }
      )
      if (!response.ok) {
        if (response.status === 401) {
          safeSet(() => {
            setNotifications([])
            setError(null)
          })
          return
        }
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        safeSet(() => {
          setError(payload?.error ?? t("notificationsLoadFailed"))
          setNotifications([])
        })
        return
      }
      const payload = (await response.json()) as {
        ok?: boolean
        notifications?: NotificationItem[]
      }
      safeSet(() => {
        setNotifications(payload.notifications ?? [])
      })
    } catch (error) {
      safeSet(() => {
        setError(
          error instanceof AsyncTimeoutError
            ? t("notificationsLoadFailed")
            : error instanceof Error
              ? error.message
              : t("notificationsLoadFailed")
        )
        setNotifications([])
      })
    } finally {
      safeSet(() => setLoading(false))
    }
  }, [email, safeSet, t])

  const markRead = useCallback(
    async (ids: string[]) => {
      if (!email || ids.length === 0) return
      const supabase = getSupabaseClient()
      if (!supabase) return
      const now = new Date().toISOString()
      const previousReadAt = new Map(
        (notifications ?? [])
          .filter((item) => ids.includes(item.id))
          .map((item) => [item.id, item.read_at] as const)
      )
      safeSet(() => {
        setNotifications((prev) =>
          (prev ?? []).map((item) =>
            ids.includes(item.id) ? { ...item, read_at: item.read_at ?? now } : item
          )
        )
      })
      try {
        await withRetry(
          () =>
            withTimeoutPromise(
              supabase
                .from("notifications")
                .update({ read_at: now })
                .in("id", ids)
                .eq("email", email),
              12000
            ),
          {
            attempts: 2,
            delayMs: 250,
            shouldRetry: (error) => error instanceof AsyncTimeoutError,
          }
        )
      } catch {
        safeSet(() => {
          setNotifications((prev) =>
            (prev ?? []).map((item) =>
              previousReadAt.has(item.id)
                ? { ...item, read_at: previousReadAt.get(item.id) ?? null }
                : item
            )
          )
        })
      }
    },
    [email, safeSet, notifications, t]
  )

  const markAllRead = useCallback(async () => {
    if (!email) return
    const ids = (notifications ?? [])
      .filter((item) => !item.read_at)
      .map((item) => item.id)
    if (ids.length === 0) return
    await markRead(ids)
  }, [email, markRead, notifications])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const unreadCount = (notifications ?? []).filter((n) => !n.read_at).length

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
  }
}