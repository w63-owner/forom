import createIntlMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"
import { isProtectedAppPath, stripLocalePrefix } from "@/lib/security/protected-routes"
import { routing } from "@/i18n/routing"
import { createMiddlewareSupabaseClient } from "@/utils/supabase/middleware"

const intlMiddleware = createIntlMiddleware(routing)

export async function proxy(request: NextRequest) {
  const { locale, normalizedPath } = stripLocalePrefix(request.nextUrl.pathname)
  const response =
    request.nextUrl.pathname.startsWith("/api") ||
    request.nextUrl.pathname.startsWith("/auth")
      ? NextResponse.next({ request })
      : await intlMiddleware(request)

  const supabase = createMiddlewareSupabaseClient(request, response)
  if (!supabase) return response

  const { data } = await supabase.auth.getUser()

  if (isProtectedAppPath(normalizedPath) && !data.user) {
    const nextPath = `${normalizedPath}${request.nextUrl.search}`
    const loginUrl = new URL(`/${locale}`, request.url)
    loginUrl.searchParams.set("auth", "signup")
    loginUrl.searchParams.set("next", nextPath)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
