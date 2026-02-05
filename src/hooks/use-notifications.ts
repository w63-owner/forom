"use client"

import { useCallback, useEffect, useState } from "react"
import { getSupabaseClient } from "@/utils/supabase/client"

export type NotificationItem = {
  id: string
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
}

export function useNotifications(email: string | null): UseNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationItem[] | null>(
    null
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!email) {
      setLoading(false)
      setNotifications([])
      setError(null)
      return
    }
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError("Supabase non configuré.")
      setNotifications([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: queryError } = await supabase
      .from("notifications")
      .select("id, title, body, link, created_at, read_at")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(20)

    if (queryError) {
      setError(queryError.message)
      setNotifications([])
    } else {
      setNotifications(data ?? [])
    }
    setLoading(false)
  }, [email])

  useEffect(() => {
    const timeout = setTimeout(() => {
      void refresh()
    }, 0)
    return () => clearTimeout(timeout)
  }, [refresh])

  const unreadCount = (notifications ?? []).filter((n) => !n.read_at).length

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh,
  }
}
