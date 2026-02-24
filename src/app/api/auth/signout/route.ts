import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { validateMutationOrigin } from "@/lib/security/origin-guard"
import { createAuthSessionTracker } from "@/lib/observability/auth-session-metrics"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const tracker = createAuthSessionTracker("auth_signout", {
    path: "/api/auth/signout",
  })
  const respond = (
    body: { ok: boolean; error?: string },
    status: number,
    outcome: "success" | "unauthorized" | "error" | "skipped",
    reason?: string
  ) => {
    tracker.complete({ statusCode: status, outcome, reason })
    return NextResponse.json(body, { status })
  }

  const originValidation = validateMutationOrigin(request)
  if (!originValidation.ok) {
    return respond(
      { ok: false, error: originValidation.reason ?? "Forbidden origin." },
      403,
      "unauthorized",
      "origin_validation_failed"
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return respond(
      { ok: false, error: "Supabase not configured." },
      500,
      "skipped",
      "supabase_env_missing"
    )
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

  const { error } = await supabase.auth.signOut()
  if (error) {
    return respond(
      { ok: false, error: error.message },
      500,
      "error",
      `signout_failed:${error.message}`
    )
  }

  return respond({ ok: true }, 200, "success")
}