import { NextResponse } from "next/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { mapSupabaseErrorToHttp } from "@/lib/security/api-error"

type AvatarBody = {
  avatarUrl?: string | null
  skip?: boolean
}

function isSafeAvatarUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "https:" || parsed.protocol === "http:"
  } catch {
    return false
  }
}

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === "42703" || error.code === "PGRST204") return true
  return /column/i.test(error.message ?? "")
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

  let body: AvatarBody
  try {
    body = (await request.json()) as AvatarBody
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 })
  }

  const skip = Boolean(body.skip)
  const avatarUrl = body.avatarUrl?.trim() ?? null

  const syncAuthMetadata = async () => {
    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        avatar_url: skip ? null : avatarUrl,
      },
    })
    if (metadataError) {
      // Do not fail avatar completion if metadata sync fails.
      console.warn("[onboarding/avatar] metadata update skipped", metadataError.message)
    }
  }

  const { data: profileState, error: stateError } = await supabase
    .from("users")
    .select("onboarding_profile_completed_at, onboarding_completed_at")
    .eq("id", userData.user.id)
    .maybeSingle()

  if (stateError && isMissingColumnError(stateError)) {
    // Backward-compatible fallback for environments missing onboarding columns.
    if (!skip) {
      if (!avatarUrl) {
        return NextResponse.json({ ok: false, error: "avatarUrl is required." }, { status: 400 })
      }
      if (!isSafeAvatarUrl(avatarUrl)) {
        return NextResponse.json({ ok: false, error: "Invalid avatarUrl." }, { status: 400 })
      }
      if (avatarUrl.length > 2048) {
        return NextResponse.json({ ok: false, error: "avatarUrl too long." }, { status: 400 })
      }
    }

    if (!skip && avatarUrl) {
      const { error: fallbackAvatarError } = await supabase
        .from("users")
        .update({ avatar_url: avatarUrl })
        .eq("id", userData.user.id)

      if (fallbackAvatarError) {
        const mapped = mapSupabaseErrorToHttp(fallbackAvatarError)
        return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status })
      }
    }
    await syncAuthMetadata()

    return NextResponse.json({
      ok: true,
      completed: true,
      skippedAvatar: skip,
      avatarUrl: skip ? null : avatarUrl,
    })
  }

  if (stateError) {
    const mapped = mapSupabaseErrorToHttp(stateError)
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status })
  }

  if (!profileState?.onboarding_profile_completed_at) {
    return NextResponse.json(
      { ok: false, error: "Complete profile step first." },
      { status: 409 }
    )
  }

  if (profileState.onboarding_completed_at) {
    await syncAuthMetadata()
    return NextResponse.json({
      ok: true,
      completed: true,
      skippedAvatar: Boolean(skip),
      avatarUrl: skip ? null : avatarUrl,
    })
  }

  if (!skip) {
    if (!avatarUrl) {
      return NextResponse.json({ ok: false, error: "avatarUrl is required." }, { status: 400 })
    }
    if (!isSafeAvatarUrl(avatarUrl)) {
      return NextResponse.json({ ok: false, error: "Invalid avatarUrl." }, { status: 400 })
    }
    if (avatarUrl.length > 2048) {
      return NextResponse.json({ ok: false, error: "avatarUrl too long." }, { status: 400 })
    }
  }

  const now = new Date().toISOString()
  const updatePayload: {
    onboarding_completed_at: string
    avatar_url?: string
  } = {
    onboarding_completed_at: now,
  }
  if (!skip && avatarUrl) {
    updatePayload.avatar_url = avatarUrl
  }

  const { error } = await supabase
    .from("users")
    .update(updatePayload)
    .eq("id", userData.user.id)

  if (error && isMissingColumnError(error)) {
    if (!skip && avatarUrl) {
      const { error: fallbackAvatarError } = await supabase
        .from("users")
        .update({ avatar_url: avatarUrl })
        .eq("id", userData.user.id)

      if (fallbackAvatarError) {
        const mapped = mapSupabaseErrorToHttp(fallbackAvatarError)
        return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status })
      }
    }
    await syncAuthMetadata()

    return NextResponse.json({
      ok: true,
      completed: true,
      skippedAvatar: skip,
      avatarUrl: skip ? null : avatarUrl,
    })
  }

  if (error) {
    const mapped = mapSupabaseErrorToHttp(error)
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status })
  }

  await syncAuthMetadata()

  return NextResponse.json({
    ok: true,
    completed: true,
    skippedAvatar: skip,
    avatarUrl: skip ? null : avatarUrl,
  })
}
