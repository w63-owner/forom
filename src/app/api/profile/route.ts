import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/i

const normalizeText = (value: unknown, maxLength = 120): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

const normalizeUrl = (value: unknown): string | null => {
  const normalized = normalizeText(value, 300)
  if (!normalized) return null
  return normalized
}

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured." }, { status: 500 })
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
  }

  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const name = normalizeText(payload.name, 80)
  const username = normalizeText(payload.username, 30)
  const country = normalizeText(payload.country, 80)
  const city = normalizeText(payload.city, 80)
  const bio = normalizeText(payload.bio, 500)
  const linkedin = normalizeUrl(payload.linkedin)
  const instagram = normalizeUrl(payload.instagram)
  const tiktok = normalizeUrl(payload.tiktok)

  if (!username || !USERNAME_PATTERN.test(username)) {
    return NextResponse.json(
      { ok: false, error: "Invalid username format." },
      { status: 400 }
    )
  }

  const { error: updateProfileError } = await supabase
    .from("users")
    .update({ username })
    .eq("id", userData.user.id)

  if (updateProfileError) {
    return NextResponse.json({ ok: false, error: updateProfileError.message }, { status: 500 })
  }

  const metadata = {
    ...(userData.user.user_metadata ?? {}),
    full_name: name,
    country,
    city,
    bio,
    linkedin,
    instagram,
    tiktok,
    username,
  }

  const { error: metadataError } = await supabase.auth.updateUser({
    data: metadata,
  })

  if (metadataError) {
    return NextResponse.json({ ok: false, error: metadataError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    profile: {
      name,
      username,
      country,
      city,
      bio,
      linkedin,
      instagram,
      tiktok,
      email: userData.user.email ?? null,
    },
  })
}
