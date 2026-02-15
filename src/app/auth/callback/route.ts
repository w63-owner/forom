import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("Supabase non configuré (variables d'environnement manquantes).")}`,
        base
      )
    )
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => {
          cookieStore.set({ name, value, ...options })
        },
        remove: (name, options) => {
          cookieStore.set({ name, value: "", ...options })
        },
      },
    })
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, base)
      )
    }
  }

  return NextResponse.redirect(new URL(safeNext, base))
}