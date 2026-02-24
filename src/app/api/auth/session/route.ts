import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => {
          cookieStore.set({ name, value, ...options })
        },
        remove: (name, options) => {
          cookieStore.set({ name, value: "", ...options })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return NextResponse.json(
      { user: null },
      { headers: { "Cache-Control": "no-store" } }
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

  return NextResponse.json(
    {
      user: {
        id,
        email: email ?? null,
        user_metadata: mergedMetadata,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}