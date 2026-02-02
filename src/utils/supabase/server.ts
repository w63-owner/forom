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
