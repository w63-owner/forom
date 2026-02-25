import { NextResponse } from "next/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"
import { getSupabaseServerClient } from "@/utils/supabase/server"

export const dynamic = "force-dynamic"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Body = {
  invitationId?: string
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

  const invitationId = body.invitationId?.trim() ?? ""
  if (!UUID_PATTERN.test(invitationId)) {
    return NextResponse.json({ ok: false, error: "Invalid invitationId." }, { status: 400 })
  }

  const { data: invitation } = await supabase
    .from("page_invitations")
    .select("id, page_id")
    .eq("id", invitationId)
    .maybeSingle()

  if (!invitation) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 })
  }

  const { data: page } = await supabase
    .from("pages")
    .select("id, owner_id")
    .eq("id", invitation.page_id)
    .maybeSingle()

  if (!page || page.owner_id !== authData.user.id) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 })
  }

  const { error } = await supabase
    .from("page_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", invitationId)
    .is("revoked_at", null)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

