"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/components/ui/toast"
import { getSupabaseClient } from "@/utils/supabase/client"
import { useNotifications } from "@/hooks/use-notifications"

type CurrentUser = {
  email: string
  displayName: string
}

export function AuthStatus() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const { showToast } = useToast()
  const { notifications, unreadCount, loading, error } = useNotifications(
    currentUser?.email ?? null
  )

  useEffect(() => {
    let isActive = true
    const supabase = getSupabaseClient()
    if (!supabase) {
      Promise.resolve().then(() => {
        if (isActive) setIsAuthenticated(false)
      })
      return
    }

    const loadForSession = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id ?? ""
      const email = userData.user?.email ?? ""

      // 1) username en base (table public.users)
      // 2) sinon username dans user_metadata
      // 3) sinon email
      // 4) sinon "Utilisateur"
      let displayName: string | null = null

      if (userId) {
        const { data: profile } = await supabase
          .from("users")
          .select("username")
          .eq("id", userId)
          .maybeSingle()
        if (profile?.username && profile.username.trim().length > 0) {
          displayName = profile.username.trim()
        }
      }

      if (!displayName) {
        const metaUsername = (
          userData.user?.user_metadata as { username?: string } | null
        )?.username
        if (metaUsername && metaUsername.trim().length > 0) {
          displayName = metaUsername.trim()
        }
      }

      if (!displayName) {
        displayName = email || "Utilisateur"
      }

      if (!email) {
        if (isActive) setCurrentUser(null)
        return
      }

      if (isActive) setCurrentUser({ email, displayName })
    }

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const hasSession = Boolean(data.session)
        if (isActive) setIsAuthenticated(hasSession)
        if (hasSession) {
          await loadForSession()
        } else {
          if (isActive) setCurrentUser(null)
        }
      })
      .catch(() => {
        // En cas d'erreur réseau/Supabase, on retombe en mode "non connecté"
        if (isActive) {
          setIsAuthenticated(false)
          setCurrentUser(null)
        }
      })

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const hasSession = Boolean(session)
        if (isActive) setIsAuthenticated(hasSession)
        if (hasSession) {
          await loadForSession()
        } else {
          if (isActive) setCurrentUser(null)
        }
      }
    )

    return () => {
      isActive = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    await supabase.auth.signOut()
    showToast({
      variant: "info",
      title: "Déconnecté",
      description: "Vous êtes maintenant déconnecté.",
    })
  }

  if (isAuthenticated === null) {
    return (
      <Button variant="ghost" size="sm" disabled>
        Chargement...
      </Button>
    )
  }

  if (!isAuthenticated) {
    return (
      <Button asChild size="sm" variant="outline" className="link-nav">
        <Link href="/login">Se connecter</Link>
      </Button>
    )
  }

  const unread = unreadCount ?? 0

  return (
    <div className="flex items-center gap-2">
      {/* Cloche notifications */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="relative"
            aria-label={
              unread > 0
                ? `${unread} notification${unread > 1 ? "s" : ""} non lue${
                    unread > 1 ? "s" : ""
                  }`
                : "Notifications"
            }
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-3">
          <div className="flex items-center justify-between pb-2">
            <span className="text-sm font-medium">Notifications</span>
            {unread > 0 && (
              <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">
                {unread} non lue{unread > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {loading && (
              <p className="text-xs text-muted-foreground">Chargement...</p>
            )}
            {!loading && error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            {!loading && !error && notifications?.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Vous n&apos;avez pas encore de notifications.
              </p>
            )}
            {notifications &&
              notifications.length > 0 &&
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start justify-between gap-3 rounded-md px-2 py-2 ${
                    n.read_at ? "opacity-75" : "bg-muted/40"
                  }`}
                >
                  <div>
                    <div className="font-medium text-[#333D42]">
                      {n.title}
                    </div>
                    {n.body && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
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
          </div>
        </PopoverContent>
      </Popover>

      {/* Menu profil avec avatar */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full px-1"
            aria-label="Ouvrir le menu profil"
          >
            <Avatar
              size="md"
              name={currentUser?.displayName ?? currentUser?.email ?? "Utilisateur"}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-2">
          <div className="mb-2 border-b pb-2 text-sm">
            {currentUser ? (
              <>
                <p className="font-medium text-[#333D42]">
                  {currentUser.displayName || currentUser.email}
                </p>
                {currentUser.email && (
                  <p className="text-xs text-muted-foreground">
                    {currentUser.email}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Chargement…</p>
            )}
          </div>
          <nav className="flex flex-col gap-1 text-sm">
            <Link
              href="/profile?view=profil"
              className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              Mon profil
            </Link>
            <Link
              href="/profile?view=mes-propositions"
              className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              Mes propositions
            </Link>
            <Link
              href="/profile?view=mes-pages"
              className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              Mes pages
            </Link>
            <Link
              href="/profile?view=notifications"
              className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              Préférences de notifications
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-1 rounded-md px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
            >
              Se déconnecter
            </button>
          </nav>
        </PopoverContent>
      </Popover>
    </div>
  )
}

