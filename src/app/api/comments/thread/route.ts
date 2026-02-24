import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { createCommentsRequestTracker } from "@/lib/observability/comments-metrics"

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
  const tracker = createCommentsRequestTracker("thread_read")
  const attemptHeader = request.headers.get("x-comments-attempt")
  const attempt = Number(attemptHeader)
  const retryCount = Number.isFinite(attempt) && attempt > 1 ? attempt - 1 : 0
  const timeoutHeader = request.headers.get("x-comments-timeouts")
  const timeoutCount = Number(timeoutHeader)
  const timedOut = Number.isFinite(timeoutCount) && timeoutCount > 0
  const respond = (
    body: { ok: boolean; error?: string; comments?: unknown[] },
    status: number,
    propositionId?: string | null
  ) => {
    tracker.complete({
      statusCode: status,
      propositionId,
      retries: retryCount,
      timedOut,
    })
    return NextResponse.json(body, { status })
  }

  const url = new URL(request.url)
  const propositionId = url.searchParams.get("propositionId")?.trim() ?? ""
  if (!propositionId || !UUID_PATTERN.test(propositionId)) {
    return respond({ ok: false, error: "Invalid propositionId." }, 400, null)
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return respond({ ok: false, error: "Supabase not configured." }, 500, propositionId)
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
    return respond({ ok: false, error: propositionError.message }, 500, propositionId)
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
    return respond({ ok: false, error: commentsError.message }, 500, propositionId)
  }

  const comments = (rawComments ?? []) as ThreadCommentRow[]
  const commentIds = comments.map((c) => c.id)
  if (commentIds.length === 0) {
    return respond({ ok: true, comments: [] }, 200, propositionId)
  }

  const { data: allVotes, error: allVotesError } = await supabase
    .from("comment_votes")
    .select("comment_id, type")
    .in("comment_id", commentIds)
  if (allVotesError) {
    return respond({ ok: false, error: allVotesError.message }, 500, propositionId)
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
    return respond({ ok: false, error: actorVotesError.message }, 500, propositionId)
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

  return respond({ ok: true, comments: enrichedComments }, 200, propositionId)
}
