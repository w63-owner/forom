import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"

export const dynamic = "force-dynamic"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ToggleSolutionBody = {
  propositionId?: string
  commentId?: string
  nextValue?: boolean
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

  let body: ToggleSolutionBody
  try {
    body = (await request.json()) as ToggleSolutionBody
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    )
  }

  const propositionId = body.propositionId?.trim() ?? ""
  const commentId = body.commentId?.trim() ?? ""
  const nextValue = Boolean(body.nextValue)

  if (!propositionId || !UUID_PATTERN.test(propositionId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid propositionId." },
      { status: 400 }
    )
  }
  if (!commentId || !UUID_PATTERN.test(commentId)) {
    return NextResponse.json({ ok: false, error: "Invalid commentId." }, { status: 400 })
  }

  const { error } = await supabase.rpc("set_comment_solution_atomic", {
    p_proposition_id: propositionId,
    p_comment_id: commentId,
    p_next_value: nextValue,
    p_actor_user_id: authData.user.id,
  })
  if (error) {
    if (error.code === "P0001" || error.message?.toLowerCase().includes("unauthorized")) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 })
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
