import { NextResponse } from "next/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { mapSupabaseErrorToHttp } from "@/lib/security/api-error"

export const dynamic = "force-dynamic"

type ProfileBody = {
  fullName?: string
  username?: string
}

const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/i

function normalizeUsername(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === "42703" || error.code === "PGRST204") return true
  return /column/i.test(error.message ?? "")
}

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured." }, { status: 500 })
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const username = normalizeUsername(searchParams.get("username"))

  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json({
      ok: true,
      username,
      available: false,
      reason: "invalid_format",
    })
  }

  const { data: existing, error } = await supabase
    .from("users")
    .select("id")
    .ilike("username", username)
    .neq("id", userData.user.id)
    .limit(1)

  if (error) {
    const mapped = mapSupabaseErrorToHttp(error)
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status })
  }

  return NextResponse.json({
    ok: true,
    username,
    available: !existing || existing.length === 0,
  })
}

export async function POST(request: Request) {
  const originValidation = validateMutationOrigin(request)
  if (!originValidation.ok) {
    return NextResponse.json(
      { ok: false, error: originValidation.reason ?? "Forbidden origin." },
      { status: 403 }
    )
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured." }, { status: 500 })
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
  }

  let body: ProfileBody
  try {
    body = (await request.json()) as ProfileBody
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 })
  }

  const fullName = body.fullName?.trim() ?? ""
  const username = normalizeUsername(body.username)

  if (fullName.length < 2) {
    return NextResponse.json(
      { ok: false, error: "fullName must be at least 2 characters." },
      { status: 400 }
    )
  }

  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json(
      { ok: false, error: "username must be 3-30 chars [a-z0-9._-]." },
      { status: 400 }
    )
  }

  const { data: existing, error: existingError } = await supabase
    .from("users")
    .select("id")
    .ilike("username", username)
    .neq("id", userData.user.id)
    .limit(1)

  if (existingError) {
    const mapped = mapSupabaseErrorToHttp(existingError)
    if (mapped.status !== 500) {
      return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status })
    }
    // If uniqueness pre-check fails for transient/schema reasons, continue and
    // rely on DB constraints during update to keep the flow resilient.
    console.warn("[onboarding/profile] username pre-check skipped", existingError.message)
  }

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { ok: false, error: "Username is already taken." },
      { status: 409 }
    )
  }

  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from("users")
    .update({
      username,
      onboarding_profile_completed_at: now,
    })
    .eq("id", userData.user.id)

  if (updateError) {
    // Backward-compatible fallback when onboarding columns are missing or when
    // onboarding timestamp write fails for transient/schema reasons.
    const { error: fallbackUpdateError } = await supabase
      .from("users")
      .update({ username })
      .eq("id", userData.user.id)

    if (!fallbackUpdateError) {
      console.warn(
        "[onboarding/profile] fallback update used",
        updateError.code,
        updateError.message
      )
    } else {
      const mapped = mapSupabaseErrorToHttp(fallbackUpdateError)
      const message =
        mapped.status === 500 && fallbackUpdateError.message
          ? fallbackUpdateError.message
          : mapped.message
      return NextResponse.json({ ok: false, error: message }, { status: mapped.status })
    }
  }

  const { error: metadataError } = await supabase.auth.updateUser({
    data: {
      username,
      full_name: fullName,
    },
  })

  if (metadataError) {
    // Do not fail the route: profile write is already persisted.
    console.warn("[onboarding/profile] metadata update skipped", metadataError.message)
  }

  return NextResponse.json({
    ok: true,
    profileCompleted: true,
    username,
  })
}
