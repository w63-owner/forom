import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let cachedClient: SupabaseClient | null | undefined

function isNavigatorLockAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes("signal is aborted") ||
    msg.includes("aborted without reason")
  )
}

export const getSupabaseClient = (): SupabaseClient | null => {
  if (cachedClient !== undefined) {
    return cachedClient
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    cachedClient = null
    return cachedClient
  }

  cachedClient = createBrowserClient(url, anonKey, {
    auth: {
      lock: async <R>(name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
        if (
          typeof globalThis !== "undefined" &&
          globalThis.navigator?.locks
        ) {
          try {
            return await globalThis.navigator.locks.request(
              name,
              acquireTimeout === 0
                ? { mode: "exclusive" as const, ifAvailable: true }
                : {
                    mode: "exclusive" as const,
                    signal: AbortSignal.timeout(
                      Math.max(acquireTimeout, 0) || 5000
                    ),
                  },
              async (lock) => {
                if (lock) {
                  return await fn()
                }
                return undefined as unknown as R
              }
            )
          } catch (error) {
            if (isNavigatorLockAbortError(error)) {
              if (process.env.NEXT_PUBLIC_AUTH_DEBUG === "true") {
                console.warn("[auth] navigator lock aborted, running without lock", name)
              }
              return await fn()
            }
            throw error
          }
        }
        return await fn()
      },
    },
  })
  return cachedClient
}