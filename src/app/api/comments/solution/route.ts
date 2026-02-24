import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"
import { createCommentsRequestTracker } from "@/lib/observability/comments-metrics"

export const dynamic = "force-dynamic"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ToggleSolutionBody = {
  propositionId?: string
  commentId?: string
  nextValue?: boolean
}

export async function POST(request: Request) {
  const tracker = createCommentsRequestTracker("comment_solution")
  const respond = (
    body: { ok: boolean; error?: string },
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

  let body: ToggleSolutionBody
  try {
    body = (await request.json()) as ToggleSolutionBody
  } catch {
    return respond(
      { ok: false, error: "Invalid JSON body." },
      400,
      null
    )
  }

  const propositionId = body.propositionId?.trim() ?? ""
  const commentId = body.commentId?.trim() ?? ""
  const nextValue = Boolean(body.nextValue)

  if (!propositionId || !UUID_PATTERN.test(propositionId)) {
    return respond(
      { ok: false, error: "Invalid propositionId." },
      400,
      propositionId
    )
  }
  if (!commentId || !UUID_PATTERN.test(commentId)) {
    return respond({ ok: false, error: "Invalid commentId." }, 400, propositionId)
  }

  const { error } = await supabase.rpc("set_comment_solution_atomic", {
    p_proposition_id: propositionId,
    p_comment_id: commentId,
    p_next_value: nextValue,
    p_actor_user_id: authData.user.id,
  })
  if (error) {
    if (error.code === "P0001" || error.message?.toLowerCase().includes("unauthorized")) {
      return respond({ ok: false, error: "Unauthorized." }, 403, propositionId)
    }
    return respond({ ok: false, error: error.message }, 500, propositionId)
  }

  return respond({ ok: true }, 200, propositionId)
}
