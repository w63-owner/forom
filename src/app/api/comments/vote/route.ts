import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"
import { createCommentsRequestTracker } from "@/lib/observability/comments-metrics"

export const dynamic = "force-dynamic"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type VoteCommentBody = {
  commentId?: string
  propositionId?: string
  type?: "Upvote" | "Downvote"
  currentVote?: "Upvote" | "Downvote" | null
}

export async function POST(request: Request) {
  const tracker = createCommentsRequestTracker("comment_vote")
  const respond = (
    body: { ok: boolean; error?: string; removed?: boolean },
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

  let body: VoteCommentBody
  try {
    body = (await request.json()) as VoteCommentBody
  } catch {
    return respond(
      { ok: false, error: "Invalid JSON body." },
      400,
      null
    )
  }

  const commentId = body.commentId?.trim() ?? ""
  const propositionIdForMetrics =
    body.propositionId && UUID_PATTERN.test(body.propositionId)
      ? body.propositionId
      : null
  const type = body.type
  const currentVote = body.currentVote ?? null

  if (!commentId || !UUID_PATTERN.test(commentId)) {
    return respond({ ok: false, error: "Invalid commentId." }, 400, propositionIdForMetrics)
  }
  if (type !== "Upvote" && type !== "Downvote") {
    return respond(
      { ok: false, error: "type must be Upvote or Downvote." },
      400,
      propositionIdForMetrics
    )
  }

  if (currentVote === type) {
    const { error } = await supabase
      .from("comment_votes")
      .delete()
      .eq("user_id", authData.user.id)
      .eq("comment_id", commentId)
    if (error) {
      return respond({ ok: false, error: error.message }, 500, propositionIdForMetrics)
    }
    return respond({ ok: true, removed: true }, 200, propositionIdForMetrics)
  }

  const { error } = await supabase
    .from("comment_votes")
    .upsert(
      {
        user_id: authData.user.id,
        comment_id: commentId,
        type,
      },
      { onConflict: "user_id,comment_id" }
    )
  if (error) {
    return respond({ ok: false, error: error.message }, 500, propositionIdForMetrics)
  }

  return respond({ ok: true, removed: false }, 200, propositionIdForMetrics)
}
