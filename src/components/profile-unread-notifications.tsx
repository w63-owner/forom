"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getLocalizedNotificationBody } from "@/lib/notification-text"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"
import {
  AsyncTimeoutError,
  withRetry,
  withTimeoutPromise,
} from "@/lib/async-resilience"

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  created_at: string
  read_at: string | null
}

export function ProfileUnreadNotifications() {
  const t = useTranslations("ProfileNotifications")
  const tCommon = useTranslations("Common")
  const tAuth = useTranslations("Auth")
  const [notifications, setNotifications] = useState<Notification[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseClient()
      if (!supabase) {
        setNotifications([])
        return
      }
      const user = await resolveAuthUser(supabase, {
        timeoutMs: 3500,
        includeServerFallback: true,
      })
      const email = user?.email
      if (!email) {
        setNotifications([])
        return
      }
      try {
        const runQuery = () =>
          supabase
            .from("notifications")
            .select("id, type, title, body, link, created_at, read_at")
            .eq("email", email)
            .order("created_at", { ascending: false })
            .limit(20)
        const { data, error: queryError } = (await withRetry(
          () => withTimeoutPromise(runQuery(), 12000),
          {
            attempts: 3,
            delayMs: 250,
            shouldRetry: () => true,
          }
        )) as Awaited<ReturnType<typeof runQuery>>
        if (queryError) {
          setError(queryError.message)
          setNotifications([])
          return
        }
        setError(null)
        setNotifications(data ?? [])
      } catch (loadError) {
        setError(
          loadError instanceof AsyncTimeoutError
            ? t("noNotificationsYet")
            : loadError instanceof Error
              ? loadError.message
              : t("noNotificationsYet")
        )
        setNotifications([])
      }
    }
    void load()
  }, [t])

  if (notifications === null) {
    return null
  }

  if (notifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("recentTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {error ?? t("noNotificationsYet")}
          </p>
        </CardContent>
      </Card>
    )
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("recentTitle")}
          {unreadCount > 0 && (
            <span className="ml-2 rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">
              {t("unreadBadge", { count: unreadCount })}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {notifications.map((n) => {
          const localizedBody = getLocalizedNotificationBody(n, tAuth)
          return (
            <div
              key={n.id}
              className={`flex items-start justify-between gap-3 rounded-md px-2 py-2 ${
                n.read_at ? "opacity-75" : "bg-muted/40"
              }`}
            >
              <div>
                <div className="font-medium text-[#333D42]">{n.title}</div>
                {localizedBody && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {localizedBody}
                  </p>
                )}
              </div>
              {n.link && (
                <Link
                  href={n.link}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {tCommon("view")}
                </Link>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
