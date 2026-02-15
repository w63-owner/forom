"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Bell, Check, X } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/components/ui/toast"
import { relativeTime } from "@/lib/utils"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"
import { shouldSetUnauthenticatedFromServerResult } from "@/utils/supabase/auth-rules"
import { useNotifications } from "@/hooks/use-notifications"
import {
  AsyncTimeoutError,
  fetchWithTimeout,
  withRetry,
  withTimeoutPromise,
} from "@/lib/async-resilience"

type CurrentUser = {
  email: string
  displayName: string
}

type SessionUser = {
  id: string
  email?: string | null
  user_metadata?: { username?: string | null } | null
}

type ParentRequestStatus = "pending" | "approved" | "rejected"
type AuthSyncPayload = {
  source: string
  isAuthenticated: boolean
  currentUser: CurrentUser | null
}

type AuthStatusProps = {
  /** Session from server (SSR). When set, used for initial state to avoid flash and false negatives. */
  initialSession?: { user: SessionUser } | null
}

const AUTH_SYNC_CHANNEL = "forom:auth-state"
const AUTH_SYNC_STORAGE_KEY = "forom:auth-state-event"

function toCurrentUser(user: SessionUser | null): CurrentUser | null {
  if (!user?.email) return null
  const metaUsername = user.user_metadata?.username
  const displayName =
    metaUsername && metaUsername.trim().length > 0
      ? metaUsername.trim()
      : user.email
  return { email: user.email, displayName }
}

function getSessionUserFromStorage(): SessionUser | null {
  if (typeof window === "undefined") return null
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) {
        continue
      }
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as
        | { user?: SessionUser; currentSession?: { user?: SessionUser } }
        | null
      const user = parsed?.currentSession?.user ?? parsed?.user ?? null
      if (user?.id) return user
    }
  } catch {
    // Ignore storage parse errors and fallback to runtime checks.
  }
  return null
}

function getParentRequestIdFromLink(link: string | null): string | null {
  if (!link) return null
  try {
    const url = new URL(link, "https://_")
    const requestId = url.searchParams.get("parent_request_id")
    if (!requestId) return null
    const normalized = requestId.trim()
    return normalized.length > 0 ? normalized : null
  } catch {
    return null
  }
}

function normalizeNotificationLink(link: string | null): string | null {
  if (!link) return null
  const trimmed = link.trim()
  if (!trimmed) return null
  return trimmed.replace(/\s+(?=\/)/g, "")
}

function formatNotificationAge(dateStr: string, locale: string): string {
  if (locale.startsWith("en")) {
    const createdAtDate = new Date(dateStr)
    const createdAt = createdAtDate.getTime()
    const nowDate = new Date()
    const now = nowDate.getTime()
    const diffSeconds = Math.max(0, Math.round((now - createdAt) / 1000))
    if (diffSeconds < 60) return "just now"
    const minutes = Math.round(diffSeconds / 60)
    if (minutes < 60) return `${minutes}mn ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.round(hours / 24)
    if (days < 7) return `${days}d ago`
    if (createdAtDate.getFullYear() !== nowDate.getFullYear()) {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(createdAtDate)
    }
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(createdAtDate)
  }
  return relativeTime(dateStr, locale)
}

function isIgnorableSessionError(error: unknown): boolean {
  if (error instanceof AsyncTimeoutError) return true
  if (error instanceof DOMException && error.name === "AbortError") return true
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === "string"
        ? error.toLowerCase()
        : ""
  return (
    message.includes("abort") ||
    message.includes("aborted") ||
    message.includes("signal is aborted") ||
    message.includes("timeout")
  )
}

export function AuthStatus({ initialSession }: AuthStatusProps = {}) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("Auth")
  const tCommon = useTranslations("Common")
  const tRequests = useTranslations("PageParentRequests")
  const initialUser =
    typeof window === "undefined"
      ? initialSession?.user ?? null
      : initialSession?.user ?? getSessionUserFromStorage()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    Boolean(initialUser)
  )
  const [authResolvedState, setAuthResolvedState] = useState<boolean>(
    Boolean(initialUser)
  )
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(
    toCurrentUser(initialUser)
  )
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(
    null
  )
  const [reviewedByRequestId, setReviewedByRequestId] = useState<
    Record<string, "approved" | "rejected">
  >({})
  const [requestStatusById, setRequestStatusById] = useState<
    Record<string, ParentRequestStatus>
  >({})
  const hadUserRef = useRef(Boolean(initialUser))
  const authSyncSourceRef = useRef(
    `auth-${Math.random().toString(36).slice(2, 10)}`
  )
  const skipNextAuthBroadcastRef = useRef(false)
  const lastNotificationsErrorRef = useRef<string | null>(null)
  const { showToast } = useToast()
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markRead,
    markAllRead,
    refresh: refreshNotifications,
  } = useNotifications(
    currentUser?.email?.trim() ? currentUser.email : null
  )

  useEffect(() => {
    if (error && error !== lastNotificationsErrorRef.current) {
      lastNotificationsErrorRef.current = error
      showToast({
        variant: "error",
        title: t("notificationsLoadFailed"),
      })
    } else if (!error) {
      lastNotificationsErrorRef.current = null
    }
  }, [error, showToast, t])

  const logAuth = useCallback((message: string, meta?: Record<string, unknown>) => {
    if (process.env.NEXT_PUBLIC_AUTH_DEBUG !== "true") return
    if (meta) {
      console.info(`[auth] ${message}`, meta)
    } else {
      console.info(`[auth] ${message}`)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const applyExternalPayload = (payload: AuthSyncPayload) => {
      if (!payload || payload.source === authSyncSourceRef.current) return
      skipNextAuthBroadcastRef.current = true
      setAuthResolvedState(true)
      setIsAuthenticated(payload.isAuthenticated)
      setCurrentUser(payload.currentUser)
      hadUserRef.current = payload.isAuthenticated
    }

    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel(AUTH_SYNC_CHANNEL)
      channel.onmessage = (event: MessageEvent<AuthSyncPayload>) => {
        applyExternalPayload(event.data)
      }
    } catch {
      channel = null
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_SYNC_STORAGE_KEY || !event.newValue) return
      try {
        const payload = JSON.parse(event.newValue) as AuthSyncPayload
        applyExternalPayload(payload)
      } catch {
        // Ignore malformed auth sync payloads.
      }
    }
    window.addEventListener("storage", onStorage)
    return () => {
      if (channel) channel.close()
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!authResolvedState) return
    if (skipNextAuthBroadcastRef.current) {
      skipNextAuthBroadcastRef.current = false
      return
    }
    const payload: AuthSyncPayload = {
      source: authSyncSourceRef.current,
      isAuthenticated,
      currentUser,
    }
    try {
      const channel = new BroadcastChannel(AUTH_SYNC_CHANNEL)
      channel.postMessage(payload)
      channel.close()
    } catch {
      // BroadcastChannel can fail in restrictive environments.
    }
    try {
      window.localStorage.setItem(AUTH_SYNC_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Ignore storage failures.
    }
  }, [authResolvedState, isAuthenticated, currentUser])

  const handleReviewParentRequest = useCallback(
    async (requestId: string, status: "approved" | "rejected") => {
      const normalizedRequestId = requestId.trim()
      if (!normalizedRequestId) {
        showToast({
          variant: "error",
          title: t("toastReviewFailed"),
        })
        return
      }
      setReviewingRequestId(requestId)
      try {
        const isTransientError = (error: unknown) => {
          if (error instanceof AsyncTimeoutError) return true
          if (error instanceof TypeError) {
            const message = error.message.toLowerCase()
            return message.includes("fetch") || message.includes("network")
          }
          return false
        }
        const res = await withRetry(
          () =>
            fetchWithTimeout(
              `/api/pages/parent-request/${encodeURIComponent(normalizedRequestId)}/review`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
              },
              12000
            ),
          {
            attempts: 3,
            delayMs: 250,
            shouldRetry: isTransientError,
          }
        )
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string }
          | null
        if (!res.ok) {
          const message =
            res.status === 401
              ? tCommon("loginRequiredTitle")
              : data?.error ?? t("toastReviewFailed")
          showToast({ variant: "error", title: message })
          return
        }
        setReviewedByRequestId((prev) => ({ ...prev, [normalizedRequestId]: status }))
        showToast({
          variant: "success",
          title:
            status === "approved"
              ? t("toastLinkApproved")
              : t("toastLinkRejected"),
        })
        void refreshNotifications()
      } catch {
        showToast({
          variant: "error",
          title: t("toastReviewFailed"),
        })
      } finally {
        setReviewingRequestId(null)
      }
    },
    [showToast, t, tCommon, refreshNotifications]
  )

  useEffect(() => {
    const requestIds = (notifications ?? [])
      .map((notification) => {
        const notificationLink = normalizeNotificationLink(notification.link)
        if (notification.type !== "page_parent_request" || !notificationLink) {
          return null
        }
        return getParentRequestIdFromLink(notificationLink)
      })
      .filter((id): id is string => Boolean(id))

    if (requestIds.length === 0) {
      setRequestStatusById({})
      return
    }

    const uniqueRequestIds = Array.from(new Set(requestIds))
    const supabase = getSupabaseClient()
    if (!supabase) return

    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from("page_parent_requests")
        .select("id, status")
        .in("id", uniqueRequestIds)

      if (cancelled || !data) return
      const next: Record<string, ParentRequestStatus> = {}
      for (const row of data) {
        if (
          typeof row.id === "string" &&
          (row.status === "pending" ||
            row.status === "approved" ||
            row.status === "rejected")
        ) {
          next[row.id] = row.status
        }
      }
      setRequestStatusById(next)
    })()

    return () => {
      cancelled = true
    }
  }, [notifications])

  useEffect(() => {
    let isActive = true
    let authResolved = false
    let fallbackTimeout: ReturnType<typeof setTimeout> | null = null
    const markResolved = () => {
      authResolved = true
      if (isActive) setAuthResolvedState(true)
      if (fallbackTimeout !== null) {
        clearTimeout(fallbackTimeout)
      }
    }
    const supabase = getSupabaseClient()
    if (!supabase) {
      Promise.resolve().then(() => {
        if (isActive) {
          setIsAuthenticated(false)
          setCurrentUser(null)
          setAuthResolvedState(true)
        }
      })
      markResolved()
      logAuth("supabase client unavailable")
      return
    }

    const loadForSession = async (user: SessionUser | null | undefined) => {
      if (!user) {
        if (isActive) setCurrentUser(null)
        return
      }
      const userId = user.id ?? ""
      const email = user.email ?? ""

      if (!email) {
        if (isActive) setCurrentUser(null)
        return
      }

      // 1) username in user_metadata
      // 2) otherwise email
      // 3) otherwise fallback label
      const metaUsername = user.user_metadata?.username
      const baseDisplayName =
        metaUsername && metaUsername.trim().length > 0
          ? metaUsername.trim()
          : email || t("fallbackUser")

      // Set UI immediately from session to avoid loading fallback sticking.
      if (isActive) setCurrentUser({ email, displayName: baseDisplayName })

      // Try to refine with profile username in DB.
      if (userId) {
        try {
          const { data: profile } = await supabase
            .from("users")
            .select("username")
            .eq("id", userId)
            .maybeSingle()
          if (profile?.username && profile.username.trim().length > 0) {
            if (isActive) {
              setCurrentUser({ email, displayName: profile.username.trim() })
            }
          }
        } catch (error) {
          logAuth("profile fetch failed", {
            message: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }

    /** Returns { ok: true, user } when we got 200 from API; only then is user: null an explicit "logged out". On error, returns { ok: false } — do not set unauthenticated. */
    const loadFromServerSession = async (): Promise<
      { ok: true; user: SessionUser | null } | { ok: false }
    > => {
      try {
        const response = await withRetry(
          () =>
            fetchWithTimeout("/api/auth/session", { cache: "no-store" }, 6000),
          {
            attempts: 2,
            delayMs: 250,
            shouldRetry: (error) => !(error instanceof AsyncTimeoutError),
          }
        )
        if (!response.ok) return { ok: false }
        const payload = (await response.json()) as {
          user: SessionUser | null
        }
        if (payload.user && isActive) {
          setIsAuthenticated(true)
          await loadForSession(payload.user)
        }
        return { ok: true, user: payload.user }
      } catch {
        return { ok: false }
      }
    }

    fallbackTimeout = setTimeout(async () => {
      if (!isActive || authResolved) return
      logAuth("session timeout fallback, checking server session")
      try {
        const user = await resolveAuthUser(supabase, {
          timeoutMs: 6000,
          includeServerFallback: true,
        })
        if (user && isActive) {
          setIsAuthenticated(true)
          hadUserRef.current = true
          await loadForSession(user as SessionUser)
          markResolved()
          return
        }
        const result = await loadFromServerSession()
        if (result.ok && result.user) {
          markResolved()
          return
        }
        if (isActive) {
          markResolved()
          if (shouldSetUnauthenticatedFromServerResult(result, hadUserRef.current)) {
            setIsAuthenticated(false)
            setCurrentUser(null)
          }
        }
      } catch (error) {
        logAuth("session fallback fetch failed", {
          message: error instanceof Error ? error.message : String(error),
        })
        if (isActive) markResolved()
        // On error, do not set unauthenticated — keep previous state.
      }
    }, 6000)

    resolveAuthUser(supabase, {
      timeoutMs: 6000,
      includeServerFallback: true,
    })
      .then(async (user) => {
        if (!isActive) return
        markResolved()
        logAuth("resolveAuthUser resolved", {
          hasSession: Boolean(user),
          userId: user?.id,
        })
        if (user) {
          setIsAuthenticated(true)
          hadUserRef.current = true
          await loadForSession(user as SessionUser)
          return
        }
        const result = await loadFromServerSession()
        if (shouldSetUnauthenticatedFromServerResult(result, hadUserRef.current)) {
          setIsAuthenticated(false)
          setCurrentUser(null)
        }
      })
      .catch((error) => {
        ;(async () => {
          try {
            const result = await loadFromServerSession()
            if (isActive && shouldSetUnauthenticatedFromServerResult(result, hadUserRef.current)) {
              setIsAuthenticated(false)
              setCurrentUser(null)
            }
            // On network/error: do not set unauthenticated
          } catch {
            // Keep previous state on error
          } finally {
            markResolved()
            logAuth("resolveAuthUser failed", {
              message: error instanceof Error ? error.message : String(error),
            })
          }
        })()
      })

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const hasSession = Boolean(session)
        if (isActive) setIsAuthenticated(hasSession)
        markResolved()
        logAuth("auth state change", {
          event: _event,
          hasSession,
          userId: session?.user?.id,
        })
        if (hasSession) {
          hadUserRef.current = true
          try {
            await loadForSession(session?.user as SessionUser | null)
          } catch (error) {
            logAuth("loadForSession failed", {
              message: error instanceof Error ? error.message : String(error),
            })
            if (isActive) setCurrentUser(null)
          }
        } else {
          // Avoid false SIGNED_OUT blips by confirming with server session first.
          const result = await loadFromServerSession()
          if (result.ok && result.user) {
            hadUserRef.current = true
            if (isActive) setIsAuthenticated(true)
            return
          }
          if (isActive) {
            if (hadUserRef.current) {
              showToast({
                variant: "info",
                title: t("sessionExpired"),
              })
              hadUserRef.current = false
            }
            setCurrentUser(null)
          }
        }
      }
    )

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      resolveAuthUser(supabase, {
        timeoutMs: 6000,
        includeServerFallback: true,
      })
        .then(async (user) => {
          if (!isActive) return
          if (user) {
            hadUserRef.current = true
            setIsAuthenticated(true)
            await loadForSession(user as SessionUser)
          } else {
            const result = await loadFromServerSession()
            if (shouldSetUnauthenticatedFromServerResult(result, hadUserRef.current)) {
              setIsAuthenticated(false)
              setCurrentUser(null)
            }
          }
        })
        .catch((error) => {
          if (isIgnorableSessionError(error)) return
          logAuth("visibility resolveAuthUser failed", {
            message: error instanceof Error ? error.message : String(error),
          })
        })
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    // Proactive refresh every 15 min while the tab is visible so the session stays alive
    const REFRESH_INTERVAL_MS = 15 * 60 * 1000
    const refreshInterval = setInterval(() => {
      if (document.visibilityState !== "visible") return
      withTimeoutPromise(supabase.auth.getSession(), 12000)
        .then(({ data: { session } }) => {
          if (session) {
            withTimeoutPromise(supabase.auth.refreshSession(), 12000).catch(() => {})
          }
        })
        .catch((error) => {
          if (isIgnorableSessionError(error)) return
          logAuth("interval getSession failed", {
            message: error instanceof Error ? error.message : String(error),
          })
        })
    }, REFRESH_INTERVAL_MS)

    return () => {
      isActive = false
      clearTimeout(fallbackTimeout)
      clearInterval(refreshInterval)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      logAuth("auth status unmounted")
      subscription.subscription.unsubscribe()
    }
  }, [logAuth, showToast, t])

  const handleSignOut = useCallback(async () => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      logAuth("signOut skipped: supabase unavailable")
      return
    }
    try {
      setIsSigningOut(true)
      setAuthResolvedState(true)
      setIsAuthenticated(false)
      setCurrentUser(null)
      await withRetry(
        () => fetchWithTimeout("/api/auth/signout", { method: "POST" }, 12000),
        {
          attempts: 2,
          delayMs: 250,
          shouldRetry: (error) => !(error instanceof AsyncTimeoutError),
        }
      ).catch(() => null)
      const { error } = await withTimeoutPromise(supabase.auth.signOut(), 12000)
      if (error) throw error
      showToast({
        variant: "success",
        title: t("toastSignedOutTitle"),
        description: t("toastSignedOutBody"),
      })
      logAuth("signOut success")
    } catch (error) {
      logAuth("signOut failed", {
        message: error instanceof Error ? error.message : String(error),
      })
      setAuthResolvedState(true)
      setIsAuthenticated(true)
      showToast({
        variant: "error",
        title: t("toastSignOutErrorTitle"),
        description: t("toastSignOutErrorBody"),
      })
    } finally {
      setIsSigningOut(false)
    }
  }, [logAuth, showToast])

  if (!authResolvedState || !isAuthenticated) {
    return (
      <Button asChild size="sm" variant="outline" className="link-nav">
        <Link href="/login">{t("login")}</Link>
      </Button>
    )
  }

  const unread = unreadCount ?? 0

  return (
    <div className="flex items-center gap-2">
      {/* Cloche notifications */}
      {/* Notifications bell */}
      <Popover
        onOpenChange={(open) => {
          if (open) {
            void markAllRead()
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="relative"
            aria-label={
              unread > 0
                ? t("ariaUnreadNotifications", { count: unread })
                : t("notificationsTitle")
            }
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -bottom-1 -right-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full border border-sky-500/50 bg-sky-500 px-1 text-[10px] font-medium text-white dark:bg-sky-600">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-3">
          <div className="flex items-center justify-between pb-2">
            <span className="text-sm font-medium">{t("notificationsTitle")}</span>
            {unread > 0 ? (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">
                  {t("unreadBadge", { count: unread })}
                </span>
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t("markAllRead")}
                </button>
              </div>
            ) : null}
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {loading && (
              <div className="space-y-2" aria-hidden="true">
                <div className="h-3 w-3/4 animate-pulse rounded-full bg-muted" />
                <div className="h-3 w-11/12 animate-pulse rounded-full bg-muted" />
                <div className="h-3 w-2/3 animate-pulse rounded-full bg-muted" />
              </div>
            )}
            {!loading && error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            {!loading && !error && notifications?.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {t("noNotifications")}
              </p>
            )}
            {notifications &&
              notifications.length > 0 &&
              notifications.map((n, index) => {
                const notificationLink = normalizeNotificationLink(n.link)
                const requestId =
                  n.type === "page_parent_request" && notificationLink
                    ? getParentRequestIdFromLink(notificationLink)
                    : null
                const reviewStatus =
                  requestId !== null ? reviewedByRequestId[requestId] : undefined
                const persistedStatus =
                  requestId !== null ? requestStatusById[requestId] : undefined
                const effectiveReviewStatus =
                  reviewStatus ??
                  (persistedStatus === "approved" || persistedStatus === "rejected"
                    ? persistedStatus
                    : undefined)
                const isReviewing =
                  requestId !== null && reviewingRequestId === requestId
                const showActions =
                  requestId !== null && !isReviewing && persistedStatus === "pending"
                const canOpenNotification = Boolean(notificationLink && !showActions)
                return (
                  <div
                    key={n.id}
                    className={`flex items-start justify-between gap-3 rounded-md px-2 py-2 ${
                      n.read_at
                        ? "bg-background/60 opacity-75"
                        : "bg-sky-500/10 dark:bg-sky-400/10"
                    } ${index > 0 ? "mt-2 border-t border-border/40 pt-3" : ""}
                    ${canOpenNotification ? "cursor-pointer hover:bg-muted/50" : ""}`}
                    role={canOpenNotification ? "button" : undefined}
                    tabIndex={canOpenNotification ? 0 : undefined}
                    onClick={() => {
                      if (!n.read_at) void markRead([n.id])
                      if (!canOpenNotification || !notificationLink) return
                      if (/^https?:\/\//i.test(notificationLink)) {
                        window.location.assign(notificationLink)
                        return
                      }
                      router.push(notificationLink)
                    }}
                    onKeyDown={(event) => {
                      if (!canOpenNotification || !notificationLink) return
                      if (event.key !== "Enter" && event.key !== " ") return
                      event.preventDefault()
                      if (!n.read_at) void markRead([n.id])
                      if (/^https?:\/\//i.test(notificationLink)) {
                        window.location.assign(notificationLink)
                        return
                      }
                      router.push(notificationLink)
                    }}
                  >
                    <div>
                      <div className="font-medium text-[#333D42]">
                        {effectiveReviewStatus === "approved"
                          ? t("notificationLinkApproved")
                          : effectiveReviewStatus === "rejected"
                            ? t("notificationLinkRejected")
                            : n.title}
                      </div>
                      {effectiveReviewStatus !== "approved" &&
                        effectiveReviewStatus !== "rejected" &&
                        n.body && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {n.body}
                        </p>
                        )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatNotificationAge(n.created_at, locale)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {showActions && (
                        <>
                          <button
                            type="button"
                            className="rounded p-1 text-green-600 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-green-500 dark:hover:bg-green-950"
                            aria-label={tRequests("approve")}
                            disabled={isReviewing}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                            }}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              void handleReviewParentRequest(
                                requestId!,
                                "approved"
                              )
                            }}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={tRequests("reject")}
                            disabled={isReviewing}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                            }}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              void handleReviewParentRequest(
                                requestId!,
                                "rejected"
                              )
                            }}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {canOpenNotification && null}
                    </div>
                  </div>
                )
              })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Profile menu with avatar */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full px-1"
            aria-label={t("openProfileMenu")}
          >
            <Avatar
              size="md"
              name={currentUser?.displayName ?? currentUser?.email ?? t("fallbackUser")}
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
              <p className="text-xs text-muted-foreground">{tCommon("loading")}</p>
            )}
          </div>
          <nav className="flex flex-col gap-1 text-sm">
            <Link
              href="/profile?view=profil"
              className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              {t("myProfile")}
            </Link>
            <Link
              href="/profile?view=mes-propositions"
              className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              {t("myPropositions")}
            </Link>
            <Link
              href="/profile?view=mes-pages"
              className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              {t("myPages")}
            </Link>
            <Link
              href="/profile?view=notifications"
              className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              {t("notificationPreferences")}
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-1 rounded-md px-2 py-1.5 text-left text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSigningOut}
            >
              {isSigningOut ? t("signingOut") : t("signOut")}
            </button>
          </nav>
        </PopoverContent>
      </Popover>
    </div>
  )
}
