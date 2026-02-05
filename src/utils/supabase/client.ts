import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let cachedClient: SupabaseClient | null | undefined

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
      lock: async (_name, _acquireTimeout, fn) => await fn(),
    },
  })
  return cachedClient
}
