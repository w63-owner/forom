import createIntlMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"
import { isProtectedAppPath, stripLocalePrefix } from "@/lib/security/protected-routes"
import { routing } from "@/i18n/routing"
import { createMiddlewareSupabaseClient } from "@/utils/supabase/middleware"
import { createAuthSessionTracker } from "@/lib/observability/auth-session-metrics"

const intlMiddleware = createIntlMiddleware(routing)
const isProxyDebugEnabled =
  process.env.AUTH_PROXY_DEBUG === "true" ||
  process.env.NEXT_PUBLIC_AUTH_DEBUG === "true"

type ProxyLogLevel = "info" | "warn" | "error"

const proxyLog = (
  level: ProxyLogLevel,
  event: string,
  payload: Record<string, unknown>
) => {
  const line = JSON.stringify({
    event,
    source: "proxy_middleware",
    ...payload,
    recordedAt: new Date().toISOString(),
  })
  if (level === "error") {
    console.error(line)
    return
  }
  if (level === "warn") {
    console.warn(line)
    return
  }
  console.info(line)
}

const isTransientAuthReason = (reason: string | null): boolean => {
  if (!reason) return false
  const normalized = reason.toLowerCase()
  return (
    normalized.startsWith("refresh_failed:") ||
    normalized.includes("timeout") ||
    normalized.includes("network") ||
    normalized.includes("fetch")
  )
}

export async function proxy(request: NextRequest) {
  const requestId =
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`) ?? "proxy-unknown"
  const isApiOrAuth =
    request.nextUrl.pathname.startsWith("/api") ||
    request.nextUrl.pathname.startsWith("/auth")
  let locale = "fr"
  let normalizedPath = request.nextUrl.pathname
  let isProtected = false
  try {
    const normalized = stripLocalePrefix(request.nextUrl.pathname)
    locale = normalized.locale
    normalizedPath = normalized.normalizedPath
    isProtected = isProtectedAppPath(normalizedPath)
  } catch (error) {
    proxyLog("warn", "auth.proxy.locale_parse_failed", {
      requestId,
      pathname: request.nextUrl.pathname,
      message: error instanceof Error ? error.message : "unknown",
    })
  }

  const tracker = createAuthSessionTracker("middleware_refresh", {
    path: request.nextUrl.pathname,
  })

  try {
    if (isProxyDebugEnabled) {
      proxyLog("info", "auth.proxy.request_start", {
        requestId,
        pathname: request.nextUrl.pathname,
        normalizedPath,
        locale,
        isApiOrAuth,
        isProtected,
        hasSupabaseEnv:
          Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
          Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      })
    }

    const response = isApiOrAuth
      ? NextResponse.next({ request })
      : await intlMiddleware(request)

    let userId: string | null = null
    let authErrorReason: string | null = null
    if (isProtected) {
      const supabase = createMiddlewareSupabaseClient(request, response)
      if (!supabase) {
        proxyLog("warn", "auth.proxy.supabase_client_unavailable", {
          requestId,
          pathname: request.nextUrl.pathname,
          normalizedPath,
          locale,
          isApiOrAuth,
          isProtected,
          hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
          hasSupabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        })
        tracker.complete({
          statusCode: 200,
          outcome: "skipped",
          reason: "supabase_client_unavailable",
        })
        return response
      }
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
        proxyLog("warn", "auth.proxy.get_user_exception", {
          requestId,
          pathname: request.nextUrl.pathname,
          normalizedPath,
          locale,
          isProtected,
          message: error instanceof Error ? error.message : "unknown",
        })
      }
    }

    if (isProtected && !userId && !isTransientAuthReason(authErrorReason)) {
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

    if (isProxyDebugEnabled) {
      proxyLog("info", "auth.proxy.request_success", {
        requestId,
        pathname: request.nextUrl.pathname,
        normalizedPath,
        locale,
        isApiOrAuth,
        isProtected,
        hasUser: Boolean(userId),
        authErrorReason,
      })
    }

    tracker.complete({
      statusCode: 200,
      outcome: isProtected
        ? userId
          ? "success"
          : isTransientAuthReason(authErrorReason)
            ? "error"
            : "no_session"
        : "skipped",
      reason: authErrorReason,
    })
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown"
    const stack = error instanceof Error ? error.stack ?? null : null
    const reason =
      error instanceof Error
        ? `middleware_exception:${error.message}`
        : "middleware_exception:unknown"
    proxyLog("error", "auth.proxy.request_failed", {
      requestId,
      pathname: request.nextUrl.pathname,
      normalizedPath,
      locale,
      isApiOrAuth,
      isProtected,
      reason,
      message,
      stack,
    })
    tracker.complete({
      statusCode: isProtected ? 307 : 200,
      outcome: "error",
      reason,
    })

    // Fail-safe behavior: keep app reachable even if middleware logic crashes.
    if (isProtected) {
      const nextPath = `${normalizedPath}${request.nextUrl.search}`
      const loginUrl = new URL(`/${locale}`, request.url)
      loginUrl.searchParams.set("auth", "signup")
      loginUrl.searchParams.set("next", nextPath)
      return NextResponse.redirect(loginUrl)
    }
    return isApiOrAuth ? NextResponse.next({ request }) : await intlMiddleware(request)
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
