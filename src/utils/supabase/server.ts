import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export const getSupabaseServerClient = async (): Promise<SupabaseClient | null> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return null
  }

  const cookieStore = await cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Ignore in read-only contexts like Server Components.
        }
      },
    },
  })
}

export type ServerSessionUser = {
  id: string
  email: string | null
  user_metadata?: { username?: string | null; avatar_url?: string | null } | null
}

type ServerSessionResolution = {
  user: ServerSessionUser | null
  transientError: boolean
  reason: string | null
}

const isTransientServerAuthError = (message: string | null): boolean => {
  if (!message) return false
  const normalized = message.toLowerCase()
  return (
    normalized.includes("refresh") ||
    normalized.includes("timeout") ||
    normalized.includes("network") ||
    normalized.includes("fetch")
  )
}

export async function resolveServerSessionUserWithRetry(
  supabase: SupabaseClient,
  options?: { attempts?: number }
): Promise<ServerSessionResolution> {
  const attempts = Math.max(1, options?.attempts ?? 2)
  let lastReason: string | null = null
  let sawTransient = false

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      lastReason = error.message
      if (isTransientServerAuthError(error.message)) {
        sawTransient = true
        continue
      }
      return { user: null, transientError: false, reason: lastReason }
    }
    if (!data?.user) {
      return { user: null, transientError: false, reason: "no_active_session" }
    }

    const u = data.user
    const { data: profile } = await supabase
      .from("users")
      .select("username, avatar_url")
      .eq("id", u.id)
      .maybeSingle()
    const mergedMetadata = {
      ...(u.user_metadata ?? {}),
      ...(profile?.username ? { username: profile.username } : {}),
      ...(profile?.avatar_url ? { avatar_url: profile.avatar_url } : {}),
    }
    return {
      user: {
        id: u.id,
        email: u.email ?? null,
        user_metadata: mergedMetadata,
      },
      transientError: false,
      reason: null,
    }
  }

  return {
    user: null,
    transientError: sawTransient,
    reason: lastReason,
  }
}

/** Session from server (cookies). Use in Server Components to pass initial auth to client. */
export async function getServerSessionUser(): Promise<ServerSessionUser | null> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null
  const resolution = await resolveServerSessionUserWithRetry(supabase)
  return resolution.user
}