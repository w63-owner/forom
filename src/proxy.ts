import createIntlMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"
import { isProtectedAppPath, stripLocalePrefix } from "@/lib/security/protected-routes"
import { routing } from "@/i18n/routing"
import { createMiddlewareSupabaseClient } from "@/utils/supabase/middleware"
import { createAuthSessionTracker } from "@/lib/observability/auth-session-metrics"

const intlMiddleware = createIntlMiddleware(routing)

export async function proxy(request: NextRequest) {
  const { locale, normalizedPath } = stripLocalePrefix(request.nextUrl.pathname)
  const isProtected = isProtectedAppPath(normalizedPath)
  const tracker = createAuthSessionTracker("middleware_refresh", {
    path: request.nextUrl.pathname,
  })
  const response =
    request.nextUrl.pathname.startsWith("/api") ||
    request.nextUrl.pathname.startsWith("/auth")
      ? NextResponse.next({ request })
      : await intlMiddleware(request)

  const supabase = createMiddlewareSupabaseClient(request, response)
  if (!supabase) {
    tracker.complete({
      statusCode: 200,
      outcome: "skipped",
      reason: "supabase_client_unavailable",
    })
    return response
  }

  let userId: string | null = null
  let authErrorReason: string | null = null
  try {
    const { data, error } = await supabase.auth.getUser()
    userId = data.user?.id ?? null
    if (error) {
      authErrorReason = `refresh_failed:${error.message}`
    }
  } catch (error) {
    authErrorReason =
      error instanceof Error
        ? `refresh_failed:${error.message}`
        : "refresh_failed:unknown"
  }

  if (isProtected && !userId) {
    const nextPath = `${normalizedPath}${request.nextUrl.search}`
    const loginUrl = new URL(`/${locale}`, request.url)
    loginUrl.searchParams.set("auth", "signup")
    loginUrl.searchParams.set("next", nextPath)
    tracker.complete({
      statusCode: 307,
      outcome: "redirect",
      reason: authErrorReason ?? "protected_route_without_session",
    })
    return NextResponse.redirect(loginUrl)
  }

  tracker.complete({
    statusCode: 200,
    outcome: userId ? "success" : "no_session",
    reason: authErrorReason,
  })
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
