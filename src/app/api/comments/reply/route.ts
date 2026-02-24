import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"

export const dynamic = "force-dynamic"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ReplyBody = {
  propositionId?: string
  parentId?: string
  content?: string
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

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
  }

  let body: ReplyBody
  try {
    body = (await request.json()) as ReplyBody
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    )
  }

  const propositionId = body.propositionId?.trim() ?? ""
  const parentId = body.parentId?.trim() ?? ""
  const content = body.content?.trim() ?? ""

  if (!propositionId || !UUID_PATTERN.test(propositionId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid propositionId." },
      { status: 400 }
    )
  }
  if (!parentId || !UUID_PATTERN.test(parentId)) {
    return NextResponse.json({ ok: false, error: "Invalid parentId." }, { status: 400 })
  }
  if (!content) {
    return NextResponse.json({ ok: false, error: "content is required." }, { status: 400 })
  }

  const { data: parent, error: parentError } = await supabase
    .from("comments")
    .select("id, proposition_id")
    .eq("id", parentId)
    .maybeSingle()
  if (parentError) {
    return NextResponse.json({ ok: false, error: parentError.message }, { status: 500 })
  }
  if (!parent || parent.proposition_id !== propositionId) {
    return NextResponse.json(
      { ok: false, error: "Reply parent/proposition mismatch." },
      { status: 400 }
    )
  }

  const { data: insertedReply, error: insertError } = await supabase
    .from("comments")
    .insert({
      proposition_id: propositionId,
      user_id: authData.user.id,
      content,
      parent_id: parentId,
    })
    .select("id")
    .single()
  if (insertError) {
    return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    commentId: insertedReply?.id ?? null,
    actorUserId: authData.user.id,
  })
}
