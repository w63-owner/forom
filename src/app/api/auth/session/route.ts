import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createAuthSessionTracker } from "@/lib/observability/auth-session-metrics"

export const dynamic = "force-dynamic"

export async function GET() {
  const tracker = createAuthSessionTracker("auth_session_route", {
    path: "/api/auth/session",
  })
  const respond = (
    body: { user: null | { id: string; email: string | null; user_metadata: unknown } },
    status: number,
    outcome: "success" | "no_session" | "error" | "skipped",
    reason?: string
  ) => {
    tracker.complete({ statusCode: status, outcome, reason })
    return NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "no-store" },
    })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return respond({ user: null }, 500, "skipped", "supabase_env_missing")
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    }
  )

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return respond(
      { user: null },
      200,
      "no_session",
      error ? `refresh_failed:${error.message}` : "no_active_session"
    )
  }

  const { id, email, user_metadata } = data.user
  const dbProfile = await supabase
    .from("users")
    .select("avatar_url, username")
    .eq("id", id)
    .maybeSingle()

  const dbAvatarUrl = dbProfile.data?.avatar_url ?? null
  const dbUsername = dbProfile.data?.username ?? null
  const mergedMetadata = {
    ...(user_metadata ?? {}),
    ...(dbUsername ? { username: dbUsername } : {}),
    ...(dbAvatarUrl ? { avatar_url: dbAvatarUrl } : {}),
  }

  return respond(
    {
      user: {
        id,
        email: email ?? null,
        user_metadata: mergedMetadata,
      },
    },
    200,
    "success"
  )
}