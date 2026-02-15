import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"

type ToggleVoteBody = {
  propositionId?: string
  target?: "upvote" | "none"
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase not configured." },
      { status: 500 }
    )
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 }
    )
  }

  let body: ToggleVoteBody
  try {
    body = (await request.json()) as ToggleVoteBody
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    )
  }

  const propositionId = body.propositionId?.trim()
  if (!propositionId) {
    return NextResponse.json(
      { ok: false, error: "propositionId is required." },
      { status: 400 }
    )
  }
  if (!UUID_PATTERN.test(propositionId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid propositionId format." },
      { status: 400 }
    )
  }

  const userId = authData.user.id

  const { data: currentVote, error: currentVoteError } = await supabase
    .from("votes")
    .select("type")
    .eq("proposition_id", propositionId)
    .eq("user_id", userId)
    .maybeSingle()

  if (currentVoteError) {
    return NextResponse.json(
      { ok: false, error: currentVoteError.message },
      { status: 500 }
    )
  }

  const hasCurrentUpvote = currentVote?.type === "Upvote"
  const desiredHasVoted =
    body.target === "upvote"
      ? true
      : body.target === "none"
        ? false
        : !hasCurrentUpvote

  if (desiredHasVoted && !hasCurrentUpvote) {
    const { error: upsertError } = await supabase.from("votes").upsert(
      {
        user_id: userId,
        proposition_id: propositionId,
        type: "Upvote",
      },
      { onConflict: "user_id,proposition_id" }
    )
    if (upsertError) {
      return NextResponse.json(
        { ok: false, error: upsertError.message },
        { status: 500 }
      )
    }
  } else if (!desiredHasVoted && hasCurrentUpvote) {
    const { error: deleteError } = await supabase
      .from("votes")
      .delete()
      .eq("proposition_id", propositionId)
      .eq("user_id", userId)
    if (deleteError) {
      return NextResponse.json(
        { ok: false, error: deleteError.message },
        { status: 500 }
      )
    }
  }

  const { data: proposition, error: propositionError } = await supabase
    .from("propositions")
    .select("votes_count")
    .eq("id", propositionId)
    .maybeSingle()
  if (propositionError) {
    return NextResponse.json(
      { ok: false, error: propositionError.message },
      { status: 500 }
    )
  }
  const nextVotes = proposition?.votes_count ?? 0

  return NextResponse.json({
    ok: true,
    hasVoted: desiredHasVoted,
    votes: nextVotes,
  })
}