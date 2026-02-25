"use client"

import type { SupabaseClient, User } from "@supabase/supabase-js"
import {
  AsyncTimeoutError,
  fetchWithTimeout,
  withRetry,
  withTimeoutPromise,
} from "@/lib/async-resilience"

type AuthSnapshot = {
  initialized: boolean
  user: User | null
  subscriptionStarted: boolean
  inFlight: Promise<User | null> | null
}

const snapshot: AuthSnapshot = {
  initialized: false,
  user: null,
  subscriptionStarted: false,
  inFlight: null,
}

const readSessionUserFromStorage = (): User | null => {
  if (typeof window === "undefined") return null
  try {
    // UX optimization only: never use localStorage state as an authorization source.
    // Server-side checks and RLS remain the source of truth for protected actions.
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as
        | { user?: Partial<User>; currentSession?: { user?: Partial<User> } }
        | null
      const storedUser = parsed?.currentSession?.user ?? parsed?.user ?? null
      if (storedUser?.id) {
        return {
          ...(storedUser as User),
          email: storedUser.email ?? undefined,
        }
      }
    }
  } catch {
    // Ignore malformed local storage and fallback to runtime checks.
  }
  return null
}

const isTimeoutLike = (error: unknown): boolean =>
  error instanceof AsyncTimeoutError ||
  (error instanceof Error && error.message.toLowerCase().includes("timeout"))

const initSnapshot = async (supabase: SupabaseClient) => {
  if (!snapshot.subscriptionStarted) {
    snapshot.subscriptionStarted = true
    supabase.auth.onAuthStateChange((_event, session) => {
      snapshot.initialized = true
      snapshot.user = session?.user ?? null
    })
  }
  if (!snapshot.user) {
    const cachedUser = readSessionUserFromStorage()
    if (cachedUser) {
      snapshot.user = cachedUser
      snapshot.initialized = true
      return
    }
  }
  if (snapshot.initialized && snapshot.user) return
  try {
    const { data } = await withRetry(
      () => withTimeoutPromise(supabase.auth.getSession(), 5000),
      {
        attempts: 2,
        delayMs: 250,
        shouldRetry: (error) => isTimeoutLike(error),
      }
    )
    snapshot.user = data.session?.user ?? null
    snapshot.initialized = true
  } catch {
    snapshot.initialized = true
  }
}

type AuthCheckOptions = {
  timeoutMs?: number
  includeServerFallback?: boolean
}

export async function resolveAuthUser(
  supabase: SupabaseClient,
  options?: AuthCheckOptions
): Promise<User | null> {
  const timeoutMs = options?.timeoutMs ?? 4000
  const includeServerFallback = options?.includeServerFallback ?? true

  await initSnapshot(supabase)
  if (snapshot.user) return snapshot.user
  if (snapshot.inFlight) return snapshot.inFlight
  snapshot.inFlight = (async () => {
    try {
      const clientPromise = withRetry(
        () => withTimeoutPromise(supabase.auth.getSession(), timeoutMs),
        {
          attempts: 2,
          delayMs: 250,
          shouldRetry: (error) => isTimeoutLike(error),
        }
      ).then(({ data }) => data.session?.user ?? null)

      const serverPromise = includeServerFallback
        ? fetchWithTimeout("/api/auth/session", { cache: "no-store" }, 7000)
            .then(async (response) => {
              if (!response.ok) return null
              const payload = (await response.json()) as {
                user: { id?: string; email?: string | null; user_metadata?: User["user_metadata"] } | null
              }
              if (!payload.user?.id) return null
              try {
                const { data } = await withRetry(
                  () => withTimeoutPromise(supabase.auth.getUser(), timeoutMs),
                  { attempts: 2, delayMs: 250, shouldRetry: (e) => isTimeoutLike(e) }
                )
                if (data.user) return data.user
              } catch {
                // Use payload as fallback below.
              }
              return {
                id: payload.user.id,
                email: payload.user.email ?? undefined,
                user_metadata: payload.user.user_metadata ?? null,
              } as User
            })
            .catch(() => null)
        : Promise.resolve(null)

      const [clientUser, serverUser] = await Promise.all([
        clientPromise,
        serverPromise,
      ])
      const user = clientUser ?? serverUser
      if (user) {
        snapshot.initialized = true
        snapshot.user = user
        return user
      }
      snapshot.initialized = true
      snapshot.user = readSessionUserFromStorage()
      return snapshot.user
    } catch {
      // Never throw to UI on transient auth fetch/timeouts.
      snapshot.initialized = true
      snapshot.user = readSessionUserFromStorage()
      return snapshot.user
    }
  })().finally(() => {
    snapshot.inFlight = null
  })

  return snapshot.inFlight
}

export function getAuthSnapshotUser(): User | null {
  return snapshot.user
}

/** Only for tests: reset module snapshot so tests don't leak state. */
export function __resetAuthSnapshotForTests(): void {
  snapshot.initialized = false
  snapshot.user = null
  snapshot.subscriptionStarted = false
  snapshot.inFlight = null
}