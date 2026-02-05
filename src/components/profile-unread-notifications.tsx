"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSupabaseClient } from "@/utils/supabase/client"

type Notification = {
  id: string
  title: string
  body: string | null
  link: string | null
  created_at: string
  read_at: string | null
}

export function ProfileUnreadNotifications() {
  const [notifications, setNotifications] = useState<Notification[] | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseClient()
      if (!supabase) {
        setNotifications([])
        return
      }
      const { data: userData } = await supabase.auth.getUser()
      const email = userData.user?.email
      if (!email) {
        setNotifications([])
        return
      }
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, link, created_at, read_at")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(20)
      setNotifications(data ?? [])
    }
    void load()
  }, [])

  if (notifications === null) {
    return null
  }

  if (notifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notifications récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Vous n&apos;avez pas encore de notifications.
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
          Notifications récentes
          {unreadCount > 0 && (
            <span className="ml-2 rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">
              {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`flex items-start justify-between gap-3 rounded-md px-2 py-2 ${
              n.read_at ? "opacity-75" : "bg-muted/40"
            }`}
          >
            <div>
              <div className="font-medium text-[#333D42]">{n.title}</div>
              {n.body && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {n.body}
                </p>
              )}
            </div>
            {n.link && (
              <Link
                href={n.link}
                className="text-xs font-medium text-primary hover:underline"
              >
                Voir
              </Link>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

