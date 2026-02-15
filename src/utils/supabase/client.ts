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
    cookies: {
      getAll() {
        if (typeof document === "undefined") return []
        if (!document.cookie) return []
        return document.cookie.split("; ").map((cookie) => {
          const [name, ...rest] = cookie.split("=")
          return { name, value: rest.join("=") }
        })
      },
      setAll(cookiesToSet) {
        if (typeof document === "undefined") return
        cookiesToSet.forEach(({ name, value, options }) => {
          let cookie = `${name}=${value}; path=${options?.path ?? "/"}`
          if (typeof options?.maxAge === "number") {
            cookie += `; max-age=${options.maxAge}`
          }
          if (options?.expires) {
            cookie += `; expires=${options.expires.toUTCString()}`
          }
          if (options?.domain) cookie += `; domain=${options.domain}`
          if (options?.sameSite) cookie += `; samesite=${options.sameSite}`
          if (options?.secure) cookie += "; secure"
          document.cookie = cookie
        })
      },
    },
  })
  return cachedClient
}