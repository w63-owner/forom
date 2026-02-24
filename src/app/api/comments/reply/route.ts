import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"
import { createCommentsRequestTracker } from "@/lib/observability/comments-metrics"

export const dynamic = "force-dynamic"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ReplyBody = {
  propositionId?: string
  parentId?: string
  content?: string
}

export async function POST(request: Request) {
  const tracker = createCommentsRequestTracker("comment_reply")
  const respond = (
    body: { ok: boolean; error?: string; commentId?: string | null; actorUserId?: string },
    status: number,
    propositionId?: string | null
  ) => {
    tracker.complete({ statusCode: status, propositionId })
    return NextResponse.json(body, { status })
  }

  const originValidation = validateMutationOrigin(request)
  if (!originValidation.ok) {
    return respond(
      { ok: false, error: originValidation.reason ?? "Forbidden origin." },
      403,
      null
    )
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return respond(
      { ok: false, error: "Supabase not configured." },
      500,
      null
    )
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return respond({ ok: false, error: "Unauthorized." }, 401, null)
  }

  let body: ReplyBody
  try {
    body = (await request.json()) as ReplyBody
  } catch {
    return respond(
      { ok: false, error: "Invalid JSON body." },
      400,
      null
    )
  }

  const propositionId = body.propositionId?.trim() ?? ""
  const parentId = body.parentId?.trim() ?? ""
  const content = body.content?.trim() ?? ""

  if (!propositionId || !UUID_PATTERN.test(propositionId)) {
    return respond(
      { ok: false, error: "Invalid propositionId." },
      400,
      propositionId
    )
  }
  if (!parentId || !UUID_PATTERN.test(parentId)) {
    return respond({ ok: false, error: "Invalid parentId." }, 400, propositionId)
  }
  if (!content) {
    return respond({ ok: false, error: "content is required." }, 400, propositionId)
  }

  const { data: parent, error: parentError } = await supabase
    .from("comments")
    .select("id, proposition_id")
    .eq("id", parentId)
    .maybeSingle()
  if (parentError) {
    return respond({ ok: false, error: parentError.message }, 500, propositionId)
  }
  if (!parent || parent.proposition_id !== propositionId) {
    return respond(
      { ok: false, error: "Reply parent/proposition mismatch." },
      400,
      propositionId
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
    return respond({ ok: false, error: insertError.message }, 500, propositionId)
  }

  return respond(
    {
      ok: true,
      commentId: insertedReply?.id ?? null,
      actorUserId: authData.user.id,
    },
    200,
    propositionId
  )
}
