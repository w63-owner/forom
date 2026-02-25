import { NextResponse } from "next/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import {
  hashInvitationToken,
  isInvitationActive,
  type InvitationRecord,
} from "@/lib/private-pages"
import { checkRateLimit } from "@/lib/private-pages-rate-limit"

export const dynamic = "force-dynamic"

type Body = {
  token?: string
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

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    "unknown"
  const ipRate = checkRateLimit({
    key: `invite_redeem_ip:${clientIp}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  })
  const userRate = checkRateLimit({
    key: `invite_redeem_user:${authData.user.id}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  })
  if (!ipRate.ok || !userRate.ok) {
    const retryAfterMs = !ipRate.ok ? ipRate.retryAfterMs : userRate.retryAfterMs
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 })
  }

  const token = body.token?.trim() ?? ""
  if (!token || token.length < 12) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 })
  }

  const tokenHash = hashInvitationToken(token)
  const { data: invitation, error: invitationError } = await supabase
    .from("page_invitations")
    .select("id, page_id, expires_at, revoked_at, max_uses, used_count")
    .eq("token_hash", tokenHash)
    .maybeSingle()

  if (invitationError) {
    return NextResponse.json({ ok: false, error: invitationError.message }, { status: 500 })
  }
  if (!invitation) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 })
  }

  if (!isInvitationActive(invitation as InvitationRecord)) {
    return NextResponse.json({ ok: false, error: "Invitation expired or revoked." }, { status: 410 })
  }

  const { data: existingMembership } = await supabase
    .from("page_members")
    .select("page_id")
    .eq("page_id", invitation.page_id)
    .eq("user_id", authData.user.id)
    .maybeSingle()

  const { data: page } = await supabase
    .from("pages")
    .select("id, slug")
    .eq("id", invitation.page_id)
    .maybeSingle()

  if (!page?.slug) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 })
  }

  if (existingMembership) {
    return NextResponse.json({
      ok: true,
      pageId: page.id,
      pageSlug: page.slug,
      alreadyMember: true,
    })
  }

  const nextUsedCount = invitation.used_count + 1
  const { error: consumeError } = await supabase
    .from("page_invitations")
    .update({ used_count: nextUsedCount, last_used_at: new Date().toISOString() })
    .eq("id", invitation.id)
    .eq("used_count", invitation.used_count)
    .is("revoked_at", null)

  if (consumeError) {
    return NextResponse.json({ ok: false, error: consumeError.message }, { status: 500 })
  }

  const { error: membershipError } = await supabase
    .from("page_members")
    .upsert(
      {
        page_id: invitation.page_id,
        user_id: authData.user.id,
        role: "viewer",
      },
      { onConflict: "page_id,user_id" }
    )

  if (membershipError) {
    return NextResponse.json({ ok: false, error: membershipError.message }, { status: 500 })
  }

  console.info("private_page_invite_redeemed", {
    pageId: page.id,
    userId: authData.user.id,
    invitationId: invitation.id,
  })

  return NextResponse.json({
    ok: true,
    pageId: page.id,
    pageSlug: page.slug,
    alreadyMember: false,
  })
}

