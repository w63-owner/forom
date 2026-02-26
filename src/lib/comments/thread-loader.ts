import type { SupabaseClient } from "@supabase/supabase-js"

export type ThreadCommentUser = {
  username: string | null
  email: string | null
  avatar_url?: string | null
}

export type EnrichedThreadComment = {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_id?: string | null
  is_solution?: boolean | null
  users?: ThreadCommentUser | ThreadCommentUser[] | null
  votesCount?: number
  currentUserVote?: "Upvote" | "Downvote" | null
  likedByAuthor?: boolean
  replies?: EnrichedThreadComment[]
}

export type CommentsLoadState =
  | "idle"
  | "loading"
  | "loaded"
  | "empty"
  | "error"

export const deriveInitialCommentsLoadState = (
  initialComments: EnrichedThreadComment[]
): CommentsLoadState => (initialComments.length > 0 ? "loaded" : "empty")

type RawCommentRow = {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_id: string | null
  is_solution: boolean | null
  users?: ThreadCommentUser | ThreadCommentUser[] | null
}

type RawVoteRow = {
  comment_id: string
  type: "Upvote" | "Downvote"
  user_id?: string
}

const DEFAULT_COMMENTS_LIMIT = 200

type LoadThreadOptions = {
  supabase: SupabaseClient
  propositionId: string
  currentUserId?: string | null
  propositionAuthorId?: string | null
  /** Max comments to load. Defaults to 200 for performance at scale. */
  limit?: number
}

export async function loadEnrichedCommentsFlat({
  supabase,
  propositionId,
  currentUserId = null,
  propositionAuthorId = null,
  limit = DEFAULT_COMMENTS_LIMIT,
}: LoadThreadOptions): Promise<{
  propositionAuthorId: string | null
  comments: EnrichedThreadComment[]
  hasMore: boolean
}> {
  let resolvedAuthorId = propositionAuthorId
  if (!resolvedAuthorId) {
    const { data: proposition, error: propositionError } = await supabase
      .from("propositions")
      .select("author_id")
      .eq("id", propositionId)
      .maybeSingle()
    if (propositionError) {
      throw new Error(propositionError.message)
    }
    resolvedAuthorId = proposition?.author_id ?? null
  }

  const fetchLimit = limit + 1
  const { data: rawComments, error: commentsError } = await supabase
    .from("comments")
    .select(
      "id, content, created_at, user_id, parent_id, is_solution, users!user_id(username, email, avatar_url)"
    )
    .eq("proposition_id", propositionId)
    .order("created_at", { ascending: false })
    .limit(fetchLimit)
  if (commentsError) {
    throw new Error(commentsError.message)
  }

  const allRows = (rawComments ?? []) as RawCommentRow[]
  const hasMore = allRows.length > limit
  const comments = hasMore ? allRows.slice(0, limit) : allRows
  const commentIds = comments.map((comment) => comment.id)
  if (commentIds.length === 0) {
    return { propositionAuthorId: resolvedAuthorId, comments: [], hasMore: false }
  }

  const { data: allVotes, error: allVotesError } = await supabase
    .from("comment_votes")
    .select("comment_id, type")
    .in("comment_id", commentIds)
  if (allVotesError) {
    throw new Error(allVotesError.message)
  }

  const actorIds = [currentUserId, resolvedAuthorId].filter(
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
    throw new Error(actorVotesError.message)
  }

  const votesByComment = new Map<
    string,
    { count: number; userVote: "Upvote" | "Downvote" | null; likedByAuthor: boolean }
  >()
  for (const id of commentIds) {
    votesByComment.set(id, { count: 0, userVote: null, likedByAuthor: false })
  }

  for (const row of (allVotes ?? []) as RawVoteRow[]) {
    const current = votesByComment.get(row.comment_id)
    if (current) {
      current.count += row.type === "Upvote" ? 1 : -1
    }
  }

  for (const row of (actorVotes ?? []) as RawVoteRow[]) {
    const current = votesByComment.get(row.comment_id)
    if (!current) continue
    if (currentUserId && row.user_id === currentUserId) {
      current.userVote = row.type
    }
    if (resolvedAuthorId && row.user_id === resolvedAuthorId && row.type === "Upvote") {
      current.likedByAuthor = true
    }
  }

  const enriched = comments.map((comment) => ({
    ...comment,
    votesCount: votesByComment.get(comment.id)?.count ?? 0,
    currentUserVote: votesByComment.get(comment.id)?.userVote ?? null,
    likedByAuthor: votesByComment.get(comment.id)?.likedByAuthor ?? false,
  }))

  return { propositionAuthorId: resolvedAuthorId, comments: enriched, hasMore }
}

export function buildCommentTree(
  items: EnrichedThreadComment[],
  parentId: string | null = null
): EnrichedThreadComment[] {
  const isTopLevel = parentId === null
  return items
    .filter((comment) => (comment.parent_id ?? null) === parentId)
    .sort((a, b) => {
      const aSolution = Boolean(a.is_solution)
      const bSolution = Boolean(b.is_solution)
      if (aSolution !== bSolution) {
        return aSolution ? -1 : 1
      }
      const timeA = new Date(a.created_at).getTime()
      const timeB = new Date(b.created_at).getTime()
      return isTopLevel ? timeB - timeA : timeA - timeB
    })
    .map((comment) => ({
      ...comment,
      replies: buildCommentTree(items, comment.id),
    }))
}
