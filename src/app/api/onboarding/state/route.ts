import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { mapSupabaseErrorToHttp } from "@/lib/security/api-error"

export const dynamic = "force-dynamic"

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === "42703" || error.code === "PGRST204") return true
  return /column/i.test(error.message ?? "")
}

export async function GET() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured." }, { status: 500 })
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("users")
    .select(
      "id, username, avatar_url, onboarding_profile_completed_at, onboarding_completed_at, onboarding_version"
    )
    .eq("id", userData.user.id)
    .maybeSingle()

  if (error && isMissingColumnError(error)) {
    // Backward-compatible fallback for environments missing onboarding columns.
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("users")
      .select("id, username, avatar_url")
      .eq("id", userData.user.id)
      .maybeSingle()

    if (fallbackError) {
      const mapped = mapSupabaseErrorToHttp(fallbackError)
      return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status })
    }

    return NextResponse.json({
      ok: true,
      onboarding: {
        profileCompleted: false,
        completed: false,
        needsOnboarding: true,
        username: fallbackData?.username ?? null,
        avatarUrl: fallbackData?.avatar_url ?? null,
        onboardingVersion: 1,
      },
    })
  }

  if (error) {
    const mapped = mapSupabaseErrorToHttp(error)
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status })
  }

  const profileCompleted = Boolean(data?.onboarding_profile_completed_at)
  const completed = Boolean(data?.onboarding_completed_at)

  return NextResponse.json({
    ok: true,
    onboarding: {
      profileCompleted,
      completed,
      needsOnboarding: !completed,
      username: data?.username ?? null,
      avatarUrl: data?.avatar_url ?? null,
      onboardingVersion: data?.onboarding_version ?? 1,
    },
  })
}
