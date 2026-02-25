import { NextResponse } from "next/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import {
  createInvitationToken,
  hashInvitationToken,
} from "@/lib/private-pages"

export const dynamic = "force-dynamic"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Body = {
  pageId?: string
  expiresInHours?: number
  maxUses?: number | null
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

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 })
  }

  const pageId = body.pageId?.trim() ?? ""
  if (!UUID_PATTERN.test(pageId)) {
    return NextResponse.json({ ok: false, error: "Invalid pageId." }, { status: 400 })
  }

  const expiresInHoursRaw = Number(body.expiresInHours ?? 72)
  const expiresInHours = Number.isFinite(expiresInHoursRaw)
    ? Math.max(1, Math.min(24 * 30, Math.floor(expiresInHoursRaw)))
    : 72
  const maxUsesRaw =
    body.maxUses === null || typeof body.maxUses === "undefined"
      ? null
      : Number(body.maxUses)
  const maxUses =
    maxUsesRaw === null
      ? null
      : Number.isFinite(maxUsesRaw)
        ? Math.max(1, Math.min(500, Math.floor(maxUsesRaw)))
        : null

  const { data: page } = await supabase
    .from("pages")
    .select("id, owner_id")
    .eq("id", pageId)
    .maybeSingle()

  if (!page) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 })
  }

  if (page.owner_id !== authData.user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 404 })
  }

  const token = createInvitationToken()
  const tokenHash = hashInvitationToken(token)
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()

  const { data: created, error: createError } = await supabase
    .from("page_invitations")
    .insert({
      page_id: pageId,
      created_by: authData.user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      max_uses: maxUses,
    })
    .select("id")
    .single()

  if (createError || !created) {
    return NextResponse.json({ ok: false, error: createError?.message ?? "Create failed." }, { status: 500 })
  }

  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? ""
  const requestOrigin = new URL(request.url).origin.replace(/\/+$/, "")
  const appUrl = configuredAppUrl.startsWith("http")
    ? configuredAppUrl.replace(/\/+$/, "")
    : process.env.NODE_ENV === "development"
      ? requestOrigin
      : "https://www.forom.app"
  const inviteUrl = `${appUrl}/fr/invite/page?token=${encodeURIComponent(token)}`

  return NextResponse.json({
    ok: true,
    invitationId: created.id,
    inviteUrl,
  })
}

