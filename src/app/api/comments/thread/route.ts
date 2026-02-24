import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"

export const dynamic = "force-dynamic"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ThreadCommentRow = {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_id: string | null
  is_solution: boolean | null
  users?:
    | { username: string | null; email: string | null; avatar_url?: string | null }
    | { username: string | null; email: string | null; avatar_url?: string | null }[]
    | null
}

export async function GET(request: Request) {
  const startedAt = Date.now()
  const url = new URL(request.url)
  const propositionId = url.searchParams.get("propositionId")?.trim() ?? ""
  if (!propositionId || !UUID_PATTERN.test(propositionId)) {
    const response = NextResponse.json(
      { ok: false, error: "Invalid propositionId." },
      { status: 400 }
    )
    response.headers.set("x-comments-latency-ms", String(Date.now() - startedAt))
    return response
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    const response = NextResponse.json(
      { ok: false, error: "Supabase not configured." },
      { status: 500 }
    )
    response.headers.set("x-comments-latency-ms", String(Date.now() - startedAt))
    return response
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const currentUserId = user?.id ?? null

  const { data: proposition, error: propositionError } = await supabase
    .from("propositions")
    .select("author_id")
    .eq("id", propositionId)
    .maybeSingle()
  if (propositionError) {
    const response = NextResponse.json(
      { ok: false, error: propositionError.message },
      { status: 500 }
    )
    response.headers.set("x-comments-latency-ms", String(Date.now() - startedAt))
    return response
  }

  const propositionAuthorId = proposition?.author_id ?? null

  const { data: rawComments, error: commentsError } = await supabase
    .from("comments")
    .select(
      "id, content, created_at, user_id, parent_id, is_solution, users!user_id(username, email, avatar_url)"
    )
    .eq("proposition_id", propositionId)
    .order("created_at", { ascending: false })

  if (commentsError) {
    const response = NextResponse.json(
      { ok: false, error: commentsError.message },
      { status: 500 }
    )
    response.headers.set("x-comments-latency-ms", String(Date.now() - startedAt))
    return response
  }

  const comments = (rawComments ?? []) as ThreadCommentRow[]
  const commentIds = comments.map((c) => c.id)
  if (commentIds.length === 0) {
    const response = NextResponse.json({ ok: true, comments: [] })
    response.headers.set("x-comments-latency-ms", String(Date.now() - startedAt))
    return response
  }

  const { data: allVotes, error: allVotesError } = await supabase
    .from("comment_votes")
    .select("comment_id, type")
    .in("comment_id", commentIds)
  if (allVotesError) {
    const response = NextResponse.json(
      { ok: false, error: allVotesError.message },
      { status: 500 }
    )
    response.headers.set("x-comments-latency-ms", String(Date.now() - startedAt))
    return response
  }

  const actorIds = [currentUserId, propositionAuthorId].filter(
    (id): id is string => Boolean(id)
  )
  const { data: actorVotes, error: actorVotesError } =
    actorIds.length > 0
      ? await supabase
          .from("comment_votes")
          .select("comment_id, type, user_id")
          .in("comment_id", commentIds)
          .in("user_id", actorIds)
      : { data: [], error: null }
  if (actorVotesError) {
    const response = NextResponse.json(
      { ok: false, error: actorVotesError.message },
      { status: 500 }
    )
    response.headers.set("x-comments-latency-ms", String(Date.now() - startedAt))
    return response
  }

  const votesByComment = new Map<
    string,
    { count: number; userVote: "Upvote" | "Downvote" | null; likedByAuthor: boolean }
  >()
  for (const id of commentIds) {
    votesByComment.set(id, { count: 0, userVote: null, likedByAuthor: false })
  }

  for (const row of allVotes ?? []) {
    const current = votesByComment.get(row.comment_id)
    if (current) {
      current.count += row.type === "Upvote" ? 1 : -1
    }
  }

  for (const row of actorVotes ?? []) {
    const current = votesByComment.get(row.comment_id)
    if (!current) continue
    if (currentUserId && row.user_id === currentUserId) {
      current.userVote = row.type as "Upvote" | "Downvote"
    }
    if (
      propositionAuthorId &&
      row.user_id === propositionAuthorId &&
      row.type === "Upvote"
    ) {
      current.likedByAuthor = true
    }
  }

  const enrichedComments = comments.map((comment) => ({
    ...comment,
    votesCount: votesByComment.get(comment.id)?.count ?? 0,
    currentUserVote: votesByComment.get(comment.id)?.userVote ?? null,
    likedByAuthor: votesByComment.get(comment.id)?.likedByAuthor ?? false,
  }))

  const response = NextResponse.json({ ok: true, comments: enrichedComments })
  response.headers.set("x-comments-latency-ms", String(Date.now() - startedAt))
  return response
}
