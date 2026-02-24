import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

const sanitizeNextPath = (value: string | null): string => {
  const next = (value ?? "/").trim()
  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/"
  }
  return next
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const safeNext = sanitizeNextPath(searchParams.get("next"))
  const base = new URL(request.url).origin
  const localeFromNext = safeNext.split("/").filter(Boolean)[0]
  const locale = localeFromNext === "fr" || localeFromNext === "en" ? localeFromNext : "fr"

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    const errorMessage = "Supabase non configuré (variables d'environnement manquantes)."
    const redirectUrl = new URL(`/${locale}`, base)
    redirectUrl.searchParams.set("auth", "login")
    redirectUrl.searchParams.set("next", safeNext)
    redirectUrl.searchParams.set("error", errorMessage)
    return NextResponse.redirect(
      redirectUrl
    )
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
    })
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      const redirectUrl = new URL(`/${locale}`, base)
      redirectUrl.searchParams.set("auth", "login")
      redirectUrl.searchParams.set("next", safeNext)
      redirectUrl.searchParams.set("error", error.message)
      return NextResponse.redirect(redirectUrl)
    }

    // After email verification/signup callback, route new users to onboarding page.
    // Existing users (e.g. password recovery) keep the original next destination.
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (!userError && userData.user) {
      const { data: onboardingRow, error: onboardingError } = await supabase
        .from("users")
        .select("onboarding_completed_at")
        .eq("id", userData.user.id)
        .maybeSingle()

      if (!onboardingError) {
        const needsOnboarding = !Boolean(onboardingRow?.onboarding_completed_at)
        if (needsOnboarding) {
          const onboardingUrl = new URL(`/${locale}/onboarding`, base)
          onboardingUrl.searchParams.set("next", safeNext)
          return NextResponse.redirect(onboardingUrl)
        }
      }
    }
  }

  return NextResponse.redirect(new URL(safeNext, base))
}