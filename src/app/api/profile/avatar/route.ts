import { NextResponse } from "next/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"
import { getSupabaseServerClient } from "@/utils/supabase/server"

export const dynamic = "force-dynamic"

type AvatarBody = {
  avatarUrl?: string | null
}

function isSafeAvatarUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false
    return parsed.hostname === "api.dicebear.com"
  } catch {
    return false
  }
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
    return NextResponse.json(
      { ok: false, error: "Supabase not configured." },
      { status: 500 }
    )
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as AvatarBody
  const avatarUrl = body.avatarUrl?.trim() ?? null

  if (avatarUrl !== null) {
    if (!isSafeAvatarUrl(avatarUrl)) {
      return NextResponse.json({ ok: false, error: "Invalid avatar URL." }, { status: 400 })
    }
    if (avatarUrl.length > 2048) {
      return NextResponse.json({ ok: false, error: "Avatar URL too long." }, { status: 400 })
    }
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ avatar_url: avatarUrl })
    .eq("id", userData.user.id)

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })
  }

  const { error: metadataError } = await supabase.auth.updateUser({
    data: {
      ...(userData.user.user_metadata ?? {}),
      avatar_url: avatarUrl,
    },
  })

  if (metadataError) {
    // Non-blocking metadata sync to avoid breaking UX on transient auth write issues.
    console.warn("[profile/avatar] metadata update skipped", metadataError.message)
  }

  return NextResponse.json({ ok: true, avatarUrl })
}
