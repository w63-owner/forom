import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"

export const dynamic = "force-dynamic"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type VoteCommentBody = {
  commentId?: string
  type?: "Upvote" | "Downvote"
  currentVote?: "Upvote" | "Downvote" | null
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

  let body: VoteCommentBody
  try {
    body = (await request.json()) as VoteCommentBody
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    )
  }

  const commentId = body.commentId?.trim() ?? ""
  const type = body.type
  const currentVote = body.currentVote ?? null

  if (!commentId || !UUID_PATTERN.test(commentId)) {
    return NextResponse.json({ ok: false, error: "Invalid commentId." }, { status: 400 })
  }
  if (type !== "Upvote" && type !== "Downvote") {
    return NextResponse.json(
      { ok: false, error: "type must be Upvote or Downvote." },
      { status: 400 }
    )
  }

  if (currentVote === type) {
    const { error } = await supabase
      .from("comment_votes")
      .delete()
      .eq("user_id", authData.user.id)
      .eq("comment_id", commentId)
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, removed: true })
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
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, removed: false })
}
