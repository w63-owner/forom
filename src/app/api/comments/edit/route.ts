import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"
import { createCommentsRequestTracker } from "@/lib/observability/comments-metrics"

export const dynamic = "force-dynamic"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type EditCommentBody = {
  propositionId?: string
  commentId?: string
  content?: string
}

export async function POST(request: Request) {
  const tracker = createCommentsRequestTracker("comment_edit")
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
    return respond({ ok: false, error: "Supabase not configured." }, 500, null)
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return respond({ ok: false, error: "Unauthorized." }, 401, null)
  }

  let body: EditCommentBody
  try {
    body = (await request.json()) as EditCommentBody
  } catch {
    return respond({ ok: false, error: "Invalid JSON body." }, 400, null)
  }

  const propositionId = body.propositionId?.trim() ?? ""
  const commentId = body.commentId?.trim() ?? ""
  const content = body.content?.trim() ?? ""

  if (!propositionId || !UUID_PATTERN.test(propositionId)) {
    return respond({ ok: false, error: "Invalid propositionId." }, 400, propositionId)
  }
  if (!commentId || !UUID_PATTERN.test(commentId)) {
    return respond({ ok: false, error: "Invalid commentId." }, 400, propositionId)
  }
  if (!content) {
    return respond({ ok: false, error: "content is required." }, 400, propositionId)
  }
  if (content.length > 5000) {
    return respond({ ok: false, error: "content is too long." }, 400, propositionId)
  }

  const { data: comment, error: commentError } = await supabase
    .from("comments")
    .select("id, proposition_id, user_id")
    .eq("id", commentId)
    .maybeSingle()

  if (commentError) {
    return respond({ ok: false, error: commentError.message }, 500, propositionId)
  }
  if (!comment || comment.proposition_id !== propositionId) {
    return respond({ ok: false, error: "Comment/proposition mismatch." }, 400, propositionId)
  }
  if (comment.user_id !== authData.user.id) {
    return respond({ ok: false, error: "Forbidden." }, 403, propositionId)
  }

  const { data: updatedComment, error: updateError } = await supabase
    .from("comments")
    .update({ content })
    .eq("id", commentId)
    .eq("user_id", authData.user.id)
    .select("id")
    .single()

  if (updateError) {
    return respond({ ok: false, error: updateError.message }, 500, propositionId)
  }

  return respond(
    {
      ok: true,
      commentId: updatedComment?.id ?? null,
      actorUserId: authData.user.id,
    },
    200,
    propositionId
  )
}
