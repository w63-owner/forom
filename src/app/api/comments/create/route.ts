import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"

export const dynamic = "force-dynamic"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type CreateCommentBody = {
  propositionId?: string
  content?: string
  parentId?: string | null
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

  let body: CreateCommentBody
  try {
    body = (await request.json()) as CreateCommentBody
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    )
  }

  const propositionId = body.propositionId?.trim() ?? ""
  const content = body.content?.trim() ?? ""
  const parentId = body.parentId?.trim() || null

  if (!propositionId || !UUID_PATTERN.test(propositionId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid propositionId." },
      { status: 400 }
    )
  }
  if (parentId && !UUID_PATTERN.test(parentId)) {
    return NextResponse.json({ ok: false, error: "Invalid parentId." }, { status: 400 })
  }
  if (!content) {
    return NextResponse.json({ ok: false, error: "content is required." }, { status: 400 })
  }
  if (content.length > 5000) {
    return NextResponse.json(
      { ok: false, error: "content is too long." },
      { status: 400 }
    )
  }

  const { data: insertedComment, error: insertError } = await supabase
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
    commentId: insertedComment?.id ?? null,
    actorUserId: authData.user.id,
  })
}
