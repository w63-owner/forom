"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Bell, Check, Loader2, X } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/components/ui/toast"
import { relativeTime } from "@/lib/utils"
import { getLocalizedNotificationBody } from "@/lib/notification-text"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"
import { shouldSetUnauthenticatedFromServerResult } from "@/utils/supabase/auth-rules"
import { useNotifications } from "@/hooks/use-notifications"
import { useAuthModal } from "@/components/auth-modal-provider"
import {
  AsyncTimeoutError,
  fetchWithTimeout,
  withRetry,
  withTimeoutPromise,
} from "@/lib/async-resilience"

type CurrentUser = {
  email: string
  displayName: string
  avatarUrl?: string | null
}

type SessionUser = {
  id: string
  email?: string | null
  user_metadata?: { username?: string | null; avatar_url?: string | null } | null
}

type ParentRequestStatus = "pending" | "approved" | "rejected"
type ParentRequestLabels = {
  parentName: string | null
  childName: string | null
}
type AuthSyncPayload = {
  source: string
  isAuthenticated: boolean
  currentUser: CurrentUser | null
}

type AuthStatusProps = {
  /** Session from server (SSR). When set, used for initial state to avoid flash and false negatives. */
  initialSession?: { user: SessionUser } | null
  className?: string
}

const AUTH_SYNC_CHANNEL = "forom:auth-state"
const AUTH_SYNC_STORAGE_KEY = "forom:auth-state-event"
const AUTH_HEARTBEAT_LEADER_KEY = "forom:auth-heartbeat-leader"
// Client-tab sync is UX-only and must never be used for authorization decisions.
// All sensitive actions are still validated server-side.

function toCurrentUser(user: SessionUser | null): CurrentUser | null {
  if (!user?.email) return null
  const metaUsername = user.user_metadata?.username
  const metaAvatarUrl = user.user_metadata?.avatar_url
  const displayName =
    metaUsername && metaUsername.trim().length > 0
      ? metaUsername.trim()
      : user.email
  return { email: user.email, displayName, avatarUrl: metaAvatarUrl ?? null }
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

function getPageParentRequestLabel(title: string): string | null {
  const trimmed = title.trim()
  if (!trimmed) return null
  const separators = [":", " : ", " - "]
  for (const separator of separators) {
    const idx = trimmed.lastIndexOf(separator)
    if (idx >= 0) {
      const candidate = trimmed.slice(idx + separator.length).trim()
      if (candidate) return candidate
    }
  }
  return trimmed
}

function getParentNameFromRequestQuestion(body: string): string | null {
  const trimmed = body.trim()
  if (!trimmed) return null
  const frMatch = trimmed.match(/sous-page de\s+(.+?)\s*\?/i)
  if (frMatch?.[1]) return frMatch[1].trim()
  const enMatch = trimmed.match(/sub-page of\s+(.+?)\s*\?/i)
  if (enMatch?.[1]) return enMatch[1].trim()
  return null
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
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

export function AuthStatus({ initialSession, className }: AuthStatusProps = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations("Auth")
  const tCommon = useTranslations("Common")
  const tRequests = useTranslations("PageParentRequests")
  const { openAuthModal } = useAuthModal()
  const initialUser =
    typeof window === "undefined"
      ? initialSession?.user ?? null
      : initialSession?.user ?? getSessionUserFromStorage()
  // SSR-first contract (Variant B):
  // - initialSession drives first paint of auth UI.
  // - Client reconciliation (storage, /api/auth/session, Supabase listeners) only refines after hydration.
  // - Never show text-based transient auth states in header ("loading", fallback labels).
  const hasInitialSession = Boolean(initialSession?.user)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    Boolean(initialUser)
  )
  const [authResolvedState, setAuthResolvedState] = useState<boolean>(
    Boolean(initialUser)
  )
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(
    toCurrentUser(initialUser)
  )
  const [avatarResolved, setAvatarResolved] = useState<boolean>(
    initialUser ? Boolean(toCurrentUser(initialUser)?.avatarUrl) : true
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
  const [requestLabelsById, setRequestLabelsById] = useState<
    Record<string, ParentRequestLabels>
  >({})
  const [requestIdByNotificationId, setRequestIdByNotificationId] = useState<
    Record<string, string>
  >({})
  const [sessionDegradedReason, setSessionDegradedReason] = useState<
    "network" | "backend" | null
  >(null)
  const refreshFailureCountRef = useRef(0)
  const lastSessionExpiredToastAtRef = useRef(0)
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

  const menuUser = useMemo(() => {
    if (currentUser) return currentUser
    const fromStorage = toCurrentUser(getSessionUserFromStorage())
    if (fromStorage) return fromStorage
    return null
  }, [currentUser])

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
      setAvatarResolved(payload.isAuthenticated ? Boolean(payload.currentUser?.avatarUrl) : true)
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

  useEffect(() => {
    if (!sessionDegradedReason) return
    showToast({
      variant: "info",
      title:
        sessionDegradedReason === "network"
          ? t("sessionNetworkIssueTitle")
          : t("sessionBackendIssueTitle"),
      description:
        sessionDegradedReason === "network"
          ? t("sessionNetworkIssueBody")
          : t("sessionBackendIssueBody"),
    })
  }, [sessionDegradedReason, showToast, t])

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
    const allNotifications = notifications ?? []
    const directRequestIdByNotificationId: Record<string, string> = {}
    const unresolvedParentRequestNotifications = allNotifications.filter((notification) => {
      if (notification.type !== "page_parent_request") return false
      const notificationLink = normalizeNotificationLink(notification.link)
      const requestId = notificationLink ? getParentRequestIdFromLink(notificationLink) : null
      if (requestId) {
        directRequestIdByNotificationId[notification.id] = requestId
        return false
      }
      return true
    })

    if (
      Object.keys(directRequestIdByNotificationId).length === 0 &&
      unresolvedParentRequestNotifications.length === 0
    ) {
      setRequestIdByNotificationId({})
      setRequestStatusById({})
      setRequestLabelsById({})
      return
    }
    const supabase = getSupabaseClient()
    if (!supabase) return

    let cancelled = false
    ;(async () => {
      try {
        const fallbackRequestIdByNotificationId: Record<string, string> = {}
        if (unresolvedParentRequestNotifications.length > 0) {
          const { data: pendingRows } = await supabase
            .from("page_parent_requests")
            .select(
              "id, created_at, parent:pages!page_parent_requests_parent_page_id_fkey(name), child:pages!page_parent_requests_child_page_id_fkey(name)"
            )
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(80)

          const normalizedPendingRows = (pendingRows ?? []).map((row) => {
            const parent = Array.isArray(row.parent) ? row.parent[0] ?? null : row.parent ?? null
            const child = Array.isArray(row.child) ? row.child[0] ?? null : row.child ?? null
            return {
              id: typeof row.id === "string" ? row.id : "",
              createdAt: row.created_at ? new Date(row.created_at).getTime() : NaN,
              parentName:
                parent && typeof parent.name === "string" ? parent.name.trim() : "",
              childName:
                child && typeof child.name === "string" ? child.name.trim() : "",
            }
          })

          unresolvedParentRequestNotifications.forEach((notification) => {
            const childLabel = getPageParentRequestLabel(notification.title)
            const parentLabel = getParentNameFromRequestQuestion(notification.body ?? "")
            const normalizedChildLabel = normalizeName(childLabel)
            const normalizedParentLabel = normalizeName(parentLabel)
            const notificationTime = notification.created_at
              ? new Date(notification.created_at).getTime()
              : NaN

            const candidates = normalizedPendingRows.filter((row) => {
              if (!row.id) return false
              const rowChild = normalizeName(row.childName)
              const rowParent = normalizeName(row.parentName)
              const childMatches = normalizedChildLabel
                ? rowChild === normalizedChildLabel
                : true
              const parentMatches = normalizedParentLabel
                ? rowParent === normalizedParentLabel
                : true
              return childMatches && parentMatches
            })

            const sortedCandidates = candidates.sort((a, b) => {
              if (!Number.isFinite(notificationTime)) return b.createdAt - a.createdAt
              const aDistance = Math.abs(a.createdAt - notificationTime)
              const bDistance = Math.abs(b.createdAt - notificationTime)
              return aDistance - bDistance
            })
            const best = sortedCandidates[0]
            if (best?.id) {
              fallbackRequestIdByNotificationId[notification.id] = best.id
            }
          })
        }

        const requestIdMap = {
          ...directRequestIdByNotificationId,
          ...fallbackRequestIdByNotificationId,
        }
        if (cancelled) return
        setRequestIdByNotificationId(requestIdMap)

        const uniqueRequestIds = Array.from(new Set(Object.values(requestIdMap)))
        if (uniqueRequestIds.length === 0) {
          setRequestStatusById({})
          setRequestLabelsById({})
          return
        }

        const { data } = await supabase
          .from("page_parent_requests")
          .select(
            "id, status, parent:pages!page_parent_requests_parent_page_id_fkey(name), child:pages!page_parent_requests_child_page_id_fkey(name)"
          )
          .in("id", uniqueRequestIds)

        if (cancelled || !data) return
        const next: Record<string, ParentRequestStatus> = {}
        const labels: Record<string, ParentRequestLabels> = {}
        for (const row of data) {
          if (
            typeof row.id === "string" &&
            (row.status === "pending" ||
              row.status === "approved" ||
              row.status === "rejected")
          ) {
            next[row.id] = row.status
            const parent = Array.isArray(row.parent) ? row.parent[0] ?? null : row.parent ?? null
            const child = Array.isArray(row.child) ? row.child[0] ?? null : row.child ?? null
            labels[row.id] = {
              parentName:
                parent && typeof parent.name === "string" && parent.name.trim().length > 0
                  ? parent.name.trim()
                  : null,
              childName:
                child && typeof child.name === "string" && child.name.trim().length > 0
                  ? child.name.trim()
                  : null,
            }
          }
        }
        setRequestStatusById(next)
        setRequestLabelsById(labels)
      } catch (error) {
        if (cancelled || isIgnorableSessionError(error)) return
        logAuth("parent request status load failed", {
          message: error instanceof Error ? error.message : String(error),
        })
      }
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
          setAvatarResolved(true)
          setAuthResolvedState(true)
        }
      })
      markResolved()
      logAuth("supabase client unavailable")
      return
    }

    const loadForSession = async (user: SessionUser | null | undefined) => {
      if (!user) {
        if (isActive) {
          setCurrentUser(null)
          setAvatarResolved(true)
        }
        return
      }
      const userId = user.id ?? ""
      const email = user.email ?? ""

      if (!email) {
        if (isActive) {
          setCurrentUser(null)
          setAvatarResolved(true)
        }
        return
      }

      // 1) username in user_metadata
      // 2) otherwise email
      // 3) otherwise fallback label
      const metaUsername = user.user_metadata?.username
      const metaAvatarUrl = user.user_metadata?.avatar_url ?? null
      const baseDisplayName =
        metaUsername && metaUsername.trim().length > 0
          ? metaUsername.trim()
          : email || t("fallbackUser")
      let resolvedDisplayName = baseDisplayName
      let resolvedAvatarUrl: string | null = metaAvatarUrl

      // Set UI immediately from session to avoid loading fallback sticking.
      if (isActive) {
        setAvatarResolved(Boolean(resolvedAvatarUrl))
        setCurrentUser({
          email,
          displayName: resolvedDisplayName,
          avatarUrl: resolvedAvatarUrl,
        })
      }

      // If session metadata is partial (common on client-side session caches),
      // enrich from server session endpoint which now merges DB profile fields.
      if ((!metaUsername || !metaAvatarUrl) && userId) {
        try {
          const response = await fetchWithTimeout(
            "/api/auth/session",
            { cache: "no-store" },
            6000
          )
          if (response.ok) {
            const payload = (await response.json().catch(() => null)) as
              | {
                  user?: {
                    id?: string | null
                    user_metadata?: { username?: string | null; avatar_url?: string | null } | null
                  } | null
                }
              | null
            if (payload?.user?.id === userId) {
              const enrichedUsername = payload.user.user_metadata?.username
              const enrichedAvatarUrl = payload.user.user_metadata?.avatar_url
              if (enrichedUsername && enrichedUsername.trim().length > 0) {
                resolvedDisplayName = enrichedUsername.trim()
              }
              if (enrichedAvatarUrl && enrichedAvatarUrl.trim().length > 0) {
                resolvedAvatarUrl = enrichedAvatarUrl.trim()
              }
              if (isActive) {
                setCurrentUser({
                  email,
                  displayName: resolvedDisplayName,
                  avatarUrl: resolvedAvatarUrl,
                })
                setAvatarResolved(Boolean(resolvedAvatarUrl))
              }
            }
          }
        } catch {
          // Keep current user fallback; DB/profile sync below may still refine.
        }
      }
      if (isActive) {
        setSessionDegradedReason(null)
        refreshFailureCountRef.current = 0
      }

      // Try to refine with profile username/avatar in DB.
      if (userId) {
        try {
          const { data: profile } = await supabase
            .from("users")
            .select("username, avatar_url")
            .eq("id", userId)
            .maybeSingle()
          if (isActive) {
            setCurrentUser({
              email,
              displayName:
                profile?.username && profile.username.trim().length > 0
                  ? profile.username.trim()
                  : resolvedDisplayName,
              avatarUrl: profile?.avatar_url ?? resolvedAvatarUrl,
            })
            setAvatarResolved(Boolean(profile?.avatar_url ?? resolvedAvatarUrl))
          }
        } catch (error) {
          logAuth("profile fetch failed", {
            message: error instanceof Error ? error.message : String(error),
          })
          if (isActive) {
            setAvatarResolved(Boolean(resolvedAvatarUrl))
          }
        }
      }
    }

    /**
     * Client resilience fallback only (post-hydration):
     * Returns { ok: true, user } when we got 200 from API; only then is user: null an explicit "logged out".
     * On error, returns { ok: false } and callers must avoid forcing unauthenticated UI.
     */
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

    const shouldThisTabLeadHeartbeat = () => {
      if (typeof window === "undefined") return true
      const now = Date.now()
      const tabId = authSyncSourceRef.current
      const LEASE_MS = 90_000
      try {
        const raw = window.localStorage.getItem(AUTH_HEARTBEAT_LEADER_KEY)
        const parsed = raw
          ? (JSON.parse(raw) as { tabId?: string; leaseUntil?: number } | null)
          : null
        if (
          parsed?.tabId === tabId ||
          !parsed?.tabId ||
          !parsed?.leaseUntil ||
          parsed.leaseUntil < now
        ) {
          window.localStorage.setItem(
            AUTH_HEARTBEAT_LEADER_KEY,
            JSON.stringify({ tabId, leaseUntil: now + LEASE_MS })
          )
          return true
        }
        return false
      } catch {
        return true
      }
    }

    const classifySessionError = (error: unknown): "network" | "backend" => {
      const message =
        error instanceof Error
          ? error.message.toLowerCase()
          : typeof error === "string"
            ? error.toLowerCase()
            : ""
      if (
        message.includes("network") ||
        message.includes("fetch") ||
        message.includes("abort") ||
        message.includes("timeout")
      ) {
        return "network"
      }
      return "backend"
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
            setAvatarResolved(true)
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
          setAvatarResolved(true)
        }
      })
      .catch((error) => {
        ;(async () => {
          try {
            const result = await loadFromServerSession()
            if (isActive && shouldSetUnauthenticatedFromServerResult(result, hadUserRef.current)) {
              setIsAuthenticated(false)
              setCurrentUser(null)
              setAvatarResolved(true)
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
            if (isActive) {
              setCurrentUser(null)
              setAvatarResolved(true)
            }
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
              const now = Date.now()
              if (now - lastSessionExpiredToastAtRef.current > 60_000) {
                showToast({
                  variant: "info",
                  title: t("sessionExpired"),
                })
                lastSessionExpiredToastAtRef.current = now
              }
              hadUserRef.current = false
            }
            setCurrentUser(null)
            setAvatarResolved(true)
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
              setAvatarResolved(true)
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
    const REFRESH_INTERVAL_MS = 20 * 60 * 1000
    const runHeartbeatRefresh = () => {
      if (!shouldThisTabLeadHeartbeat()) return
      if (document.visibilityState !== "visible") return
      withTimeoutPromise(supabase.auth.getSession(), 12000)
        .then(({ data: { session } }) => {
          if (session) {
            withTimeoutPromise(supabase.auth.refreshSession(), 12000)
              .then(() => {
                refreshFailureCountRef.current = 0
                if (isActive) setSessionDegradedReason(null)
              })
              .catch((error) => {
                const reason = classifySessionError(error)
                refreshFailureCountRef.current += 1
                if (isActive && refreshFailureCountRef.current <= 3) {
                  setSessionDegradedReason(reason)
                }
              })
          }
        })
        .catch((error) => {
          if (isIgnorableSessionError(error)) return
          const reason = classifySessionError(error)
          refreshFailureCountRef.current += 1
          if (isActive && refreshFailureCountRef.current <= 3) {
            setSessionDegradedReason(reason)
          }
          logAuth("interval getSession failed", {
            message: error instanceof Error ? error.message : String(error),
          })
        })
    }
    const refreshInterval = setInterval(runHeartbeatRefresh, REFRESH_INTERVAL_MS)
    const refreshRetryFast = setInterval(() => {
      if (refreshFailureCountRef.current <= 0) return
      if (refreshFailureCountRef.current > 3) return
      runHeartbeatRefresh()
    }, 60_000)
    const refreshRetryMedium = setInterval(() => {
      if (refreshFailureCountRef.current <= 1) return
      if (refreshFailureCountRef.current > 3) return
      runHeartbeatRefresh()
    }, 120_000)
    const refreshRetrySlow = setInterval(() => {
      if (refreshFailureCountRef.current <= 2) return
      if (refreshFailureCountRef.current > 3) return
      runHeartbeatRefresh()
    }, 300_000)

    return () => {
      isActive = false
      clearTimeout(fallbackTimeout)
      clearInterval(refreshInterval)
      clearInterval(refreshRetryFast)
      clearInterval(refreshRetryMedium)
      clearInterval(refreshRetrySlow)
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
      setAvatarResolved(true)
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

  if (!isAuthenticated) {
    if (!authResolvedState && hasInitialSession) {
      return (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="relative"
            aria-label={t("notificationsTitle")}
            disabled
          >
            <Bell className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full px-1"
            aria-label={t("openProfileMenu")}
            disabled
          >
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 animate-pulse rounded-full border-2 border-card bg-muted"
            />
          </Button>
        </div>
      )
    }
    return (
      <Button
        size="sm"
        variant="outline"
        className="link-nav"
        onClick={() => openAuthModal("signup", pathname || `/${locale}`)}
      >
        {t("login")}
      </Button>
    )
  }

  const unread = unreadCount ?? 0

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`.trim()}>
      {/* Cloche notifications */}
      {/* Notifications bell */}
      <Popover>
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
                  n.type === "page_parent_request"
                    ? requestIdByNotificationId[n.id] ?? null
                    : null
                const reviewStatus =
                  requestId !== null ? reviewedByRequestId[requestId] : undefined
                const persistedStatus =
                  requestId !== null ? requestStatusById[requestId] : undefined
                const requestLabels =
                  requestId !== null ? requestLabelsById[requestId] : undefined
                const effectiveReviewStatus =
                  reviewStatus ??
                  (persistedStatus === "approved" || persistedStatus === "rejected"
                    ? persistedStatus
                    : undefined)
                const isReviewing =
                  requestId !== null && reviewingRequestId === requestId
                const showActions =
                  requestId !== null &&
                  !isReviewing &&
                  persistedStatus !== "approved" &&
                  persistedStatus !== "rejected"
                const canOpenNotification = Boolean(notificationLink && !showActions)
                const requestLabel =
                  n.type === "page_parent_request"
                    ? getPageParentRequestLabel(n.title)
                    : null
                const parentName =
                  requestLabels?.parentName?.trim() ||
                  requestLabel ||
                  tCommon("page")
                const childName =
                  requestLabels?.childName?.trim() ||
                  requestLabel ||
                  tCommon("page")
                const localizedTitle =
                  n.type === "page_parent_request"
                    ? t("notificationParentRequestTitleWithParent", {
                        parentName,
                      })
                    : n.title
                const localizedBody =
                  effectiveReviewStatus === "approved"
                    ? t("notificationRequestApprovedByYou")
                    : effectiveReviewStatus === "rejected"
                      ? t("notificationRequestRejectedByYou")
                      : n.type === "page_parent_request"
                        ? t("notificationParentRequestQuestion", {
                            childName,
                            parentName,
                          })
                        : getLocalizedNotificationBody(n, t)
                return (
                  <div
                    key={n.id}
                    className={`flex items-center justify-between gap-3 rounded-md px-2 py-2 ${
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
                            : localizedTitle}
                      </div>
                      {localizedBody && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {localizedBody}
                        </p>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatNotificationAge(n.created_at, locale)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {isReviewing && (
                        <span
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground"
                          aria-hidden="true"
                        >
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </span>
                      )}
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
                      {!isReviewing && effectiveReviewStatus === "approved" && (
                        <span
                          className="inline-flex h-6 w-6 items-center justify-center rounded bg-green-100 text-green-700 animate-in zoom-in-90 fade-in duration-200 dark:bg-green-950 dark:text-green-400"
                          aria-label={t("notificationLinkApproved")}
                        >
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                      {!isReviewing && effectiveReviewStatus === "rejected" && (
                        <span
                          className="inline-flex h-6 w-6 items-center justify-center rounded bg-destructive/10 text-destructive animate-in zoom-in-90 fade-in duration-200"
                          aria-label={t("notificationLinkRejected")}
                        >
                          <X className="h-4 w-4" />
                        </span>
                      )}
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
            {currentUser ? (
              currentUser.avatarUrl ? (
                <Avatar
                  size="md"
                  name={currentUser.displayName ?? currentUser.email}
                  src={currentUser.avatarUrl}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className={`inline-flex h-8 w-8 rounded-full border-2 border-card bg-muted ${
                    avatarResolved ? "" : "animate-pulse"
                  }`}
                />
              )
            ) : (
              <span
                aria-hidden="true"
                className="inline-flex h-8 w-8 animate-pulse rounded-full border-2 border-card bg-muted"
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-2">
          <div className="mb-2 border-b pb-2 text-sm">
            {menuUser ? (
              <>
                <p className="font-medium text-[#333D42]">
                  {menuUser.displayName || menuUser.email}
                </p>
                {menuUser.email &&
                  menuUser.email !== menuUser.displayName && (
                    <p className="text-xs text-muted-foreground">
                      {menuUser.email}
                    </p>
                  )}
              </>
            ) : (
              <div className="space-y-2 py-0.5" aria-hidden="true">
                <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
                <div className="h-3 w-32 animate-pulse rounded-full bg-muted" />
              </div>
            )}
          </div>
          <nav className="flex flex-col gap-1 text-sm">
            <Link
              href={`/${locale}/profile?view=profil`}
              className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              {t("myProfile")}
            </Link>
            <Link
              href={`/${locale}/profile?view=mes-propositions`}
              className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              {t("myPropositions")}
            </Link>
            <Link
              href={`/${locale}/profile?view=mes-pages`}
              className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              {t("myPages")}
            </Link>
            <Link
              href={`/${locale}/profile?view=notifications`}
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
