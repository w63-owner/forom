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
      get: (name) => cookieStore.get(name)?.value,
      set: (name, value, options) => {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {
          // Ignore in read-only contexts like Server Components.
        }
      },
      remove: (name, options) => {
        try {
          cookieStore.set({ name, value: "", ...options })
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

/** Session from server (cookies). Use in Server Components to pass initial auth to client. */
export async function getServerSessionUser(): Promise<ServerSessionUser | null> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return null
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
    id: u.id,
    email: u.email ?? null,
    user_metadata: mergedMetadata,
  }
}