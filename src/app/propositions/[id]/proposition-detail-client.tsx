"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ThumbsDown, ThumbsUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { getSupabaseClient } from "@/utils/supabase/client"

type Props = {
  propositionId: string
  propositionAuthorId: string | null
}

type CommentItem = {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_id?: string | null
  is_solution?: boolean | null
  users?:
    | { username: string | null; email: string | null }
    | { username: string | null; email: string | null }[]
    | null
  replies?: CommentItem[]
  votesCount?: number
  currentUserVote?: "Upvote" | "Downvote" | null
}

type CommentBlockProps = {
  comment: CommentItem
  depth: number
  getUserMeta: (
    users:
      | { username: string | null; email: string | null }
      | { username: string | null; email: string | null }[]
      | null
      | undefined
  ) => { username: string | null; email: string | null } | null
  relativeTime: (dateStr: string) => string
  isAuthor: boolean
  currentUserId: string | null
  replyingToId: string | null
  setReplyingToId: (id: string | null) => void
  replyContent: string
  setReplyContent: (v: string) => void
  replySubmitting: boolean
  onToggleSolution: (commentId: string, nextValue: boolean) => void
  onVote: (commentId: string, type: "Upvote" | "Downvote") => void
  onSubmitReply: (parentId: string) => void
}

function CommentBlock({
  comment,
  depth,
  getUserMeta,
  relativeTime,
  isAuthor,
  currentUserId,
  replyingToId,
  setReplyingToId,
  replyContent,
  setReplyContent,
  replySubmitting,
  onToggleSolution,
  onVote,
  onSubmitReply,
}: CommentBlockProps) {
  const meta = getUserMeta(comment.users)
  const username = meta?.username || meta?.email || "Anonyme"
  const isReplying = replyingToId === comment.id
  const indent = depth > 0 ? "pl-6 border-l-2 border-border/60" : ""

  return (
    <div className={`py-3 ${indent}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground">
          <span className="font-semibold">{username}</span>
          <span className="ml-1.5 text-muted-foreground font-normal">
            {relativeTime(comment.created_at)}
          </span>
        </p>
        {comment.is_solution && (
          <Badge variant="secondary">Solution validée</Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-foreground">{comment.content}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            className={
              comment.currentUserVote === "Upvote"
                ? "text-primary"
                : "text-muted-foreground"
            }
            onClick={() => (currentUserId ? onVote(comment.id, "Upvote") : null)}
            disabled={!currentUserId}
          >
            <ThumbsUp className="size-3" />
          </Button>
          <span className="min-w-[1.25rem] text-center text-xs text-muted-foreground">
            {comment.votesCount ?? 0}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            className={
              comment.currentUserVote === "Downvote"
                ? "text-destructive"
                : "text-muted-foreground"
            }
            onClick={() =>
              currentUserId ? onVote(comment.id, "Downvote") : null
            }
            disabled={!currentUserId}
          >
            <ThumbsDown className="size-3" />
          </Button>
        </div>
        {currentUserId && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              const targetId = comment.parent_id ?? comment.id
              setReplyingToId(replyingToId === targetId ? null : targetId)
            }}
          >
            Répondre
          </Button>
        )}
        {isAuthor && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() =>
              onToggleSolution(comment.id, !comment.is_solution)
            }
          >
            {comment.is_solution
              ? "Retirer la solution"
              : "Marquer comme solution"}
          </Button>
        )}
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-1">
          {comment.replies.map((reply) => (
            <CommentBlock
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              getUserMeta={getUserMeta}
              relativeTime={relativeTime}
              isAuthor={isAuthor}
              currentUserId={currentUserId}
              replyingToId={replyingToId}
              setReplyingToId={setReplyingToId}
              replyContent={replyContent}
              setReplyContent={setReplyContent}
              replySubmitting={replySubmitting}
              onToggleSolution={onToggleSolution}
              onVote={onVote}
              onSubmitReply={onSubmitReply}
            />
          ))}
        </div>
      )}
      {isReplying && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Répondre..."
            rows={2}
            className="min-h-10 resize-none text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setReplyContent("")
                setReplyingToId(null)
              }}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={() => onSubmitReply(comment.parent_id ?? comment.id)}
              disabled={replySubmitting || !replyContent.trim()}
            >
              Publier
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PropositionDetailClient({
  propositionId,
  propositionAuthorId,
}: Props) {
  const router = useRouter()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [commentValue, setCommentValue] = useState("")
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentInputFocused, setCommentInputFocused] = useState(false)
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [replySubmitting, setReplySubmitting] = useState(false)

  const relativeTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const sec = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (sec < 60) return "à l'instant"
    const min = Math.floor(sec / 60)
    if (min < 60) return `il y a ${min} min`
    const h = Math.floor(min / 60)
    if (h < 24) return `il y a ${h} h`
    const days = Math.floor(h / 24)
    if (days === 1) return "hier"
    if (days < 7) return `il y a ${days} j`
    const weeks = Math.floor(days / 7)
    if (weeks < 4) return `il y a ${weeks} sem.`
    const months = Math.floor(days / 30)
    if (months < 12) return `il y a ${months} mois`
    const years = Math.floor(days / 365)
    return `il y a ${years} an${years > 1 ? "s" : ""}`
  }

  const getUserMeta = (
    users:
      | { username: string | null; email: string | null }
      | { username: string | null; email: string | null }[]
      | null
      | undefined
  ): { username: string | null; email: string | null } | null =>
    (Array.isArray(users) ? users[0] : users) ?? null

  const isAuthor =
    Boolean(currentUserId) &&
    Boolean(propositionAuthorId) &&
    currentUserId === propositionAuthorId

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data: session }) => {
      setCurrentUserId(session.user?.id ?? null)
    })
  }, [])

  const fetchComments = useCallback(async () => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setCommentsError("Supabase non configuré.")
      setCommentsLoading(false)
      return
    }
    setCommentsLoading(true)
    setCommentsError(null)
    try {
      const { data: rawComments, error: commentsError } = await supabase
        .from("comments")
        .select(
          "id, content, created_at, user_id, parent_id, is_solution, users!user_id(username, email)"
        )
        .eq("proposition_id", propositionId)
        .order("created_at", { ascending: false })
      if (commentsError) {
        setCommentsError(commentsError.message)
        setComments([])
        return
      }
      const list = (rawComments ?? []) as (CommentItem & {
        parent_id?: string | null
      })[]
      const ids = list.map((c) => c.id)
      const votesByComment = new Map<
        string,
        { count: number; userVote: "Upvote" | "Downvote" | null }
      >()
      for (const id of ids) {
        votesByComment.set(id, { count: 0, userVote: null })
      }
      if (ids.length > 0) {
        const { data: allVotes } = await supabase
          .from("comment_votes")
          .select("comment_id, type")
          .in("comment_id", ids)
        for (const row of allVotes ?? []) {
          const cur = votesByComment.get(row.comment_id)
          if (cur) cur.count += row.type === "Upvote" ? 1 : -1
        }
        if (currentUserId) {
          const { data: userVotes } = await supabase
            .from("comment_votes")
            .select("comment_id, type")
            .eq("user_id", currentUserId)
            .in("comment_id", ids)
          for (const row of userVotes ?? []) {
            const cur = votesByComment.get(row.comment_id)
            if (cur) cur.userVote = row.type as "Upvote" | "Downvote"
          }
        }
      }
      const withVotes = list.map((c) => ({
        ...c,
        votesCount: votesByComment.get(c.id)?.count ?? 0,
        currentUserVote: votesByComment.get(c.id)?.userVote ?? null,
      }))
      const buildTree = (
        items: CommentItem[],
        parentId: string | null
      ): CommentItem[] =>
        items
          .filter((c) => (c.parent_id ?? null) === parentId)
          .sort((a, b) => {
            const timeA = new Date(a.created_at).getTime()
            const timeB = new Date(b.created_at).getTime()
            return timeA - timeB
          })
          .map((c) => ({
            ...c,
            replies: buildTree(items, c.id),
          }))
      const withReplies = buildTree(withVotes, null)
      setComments(withReplies)
    } catch (err) {
      setCommentsError(
        err instanceof Error ? err.message : "Erreur de chargement des commentaires."
      )
      setComments([])
    } finally {
      setCommentsLoading(false)
    }
  }, [currentUserId, propositionId])

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchComments()
    }, 0)
    return () => clearTimeout(timeout)
  }, [fetchComments])

  const handleSubmitComment = async () => {
    if (!commentValue.trim()) return
    const supabase = getSupabaseClient()
    if (!supabase) {
      setCommentsError("Supabase non configuré.")
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push(`/login?next=/propositions/${propositionId}`)
      return
    }


    setCommentSubmitting(true)
    setCommentsError(null)
    const { data: insertedComment, error: insertError } = await supabase
      .from("comments")
      .insert({
        proposition_id: propositionId,
        user_id: userData.user.id,
        content: commentValue.trim(),
      })
      .select("id")
      .single()

    if (insertError) {
      setCommentsError(insertError.message)
      setCommentSubmitting(false)
      return
    }

    setCommentValue("")
    setCommentInputFocused(false)
    commentTextareaRef.current?.blur()
    await fetchComments()
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "comment_created",
        propositionId,
        commentId: insertedComment?.id,
        actorUserId: userData.user.id,
      }),
    }).catch(() => null)
    setCommentSubmitting(false)
  }

  const handleToggleSolution = async (commentId: string, nextValue: boolean) => {
    if (!isAuthor) return
    const supabase = getSupabaseClient()
    if (!supabase) {
      setCommentsError("Supabase non configuré.")
      return
    }
    setCommentsError(null)
    if (nextValue) {
      await supabase
        .from("comments")
        .update({ is_solution: false })
        .eq("proposition_id", propositionId)
    }
    const { error: updateError } = await supabase
      .from("comments")
      .update({ is_solution: nextValue })
      .eq("id", commentId)
    if (updateError) {
      setCommentsError(updateError.message)
      return
    }
    await fetchComments()
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: nextValue ? "solution_marked" : "solution_unmarked",
        propositionId,
        commentId,
        actorUserId: currentUserId,
      }),
    }).catch(() => null)
  }

  const handleCommentVote = async (
    commentId: string,
    type: "Upvote" | "Downvote"
  ) => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push(`/login?next=/propositions/${propositionId}`)
      return
    }
    await supabase.from("comment_votes").upsert(
      {
        user_id: userData.user.id,
        comment_id: commentId,
        type,
      },
      { onConflict: "user_id,comment_id" }
    )
    await fetchComments()
  }

  const handleSubmitReply = async (parentId: string) => {
    const content = replyContent.trim()
    if (!content) return
    const supabase = getSupabaseClient()
    if (!supabase) {
      setCommentsError("Supabase non configuré.")
      return
    }
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push(`/login?next=/propositions/${propositionId}`)
      return
    }
    setReplySubmitting(true)
    setCommentsError(null)
    const { error: insertError } = await supabase
      .from("comments")
      .insert({
        proposition_id: propositionId,
        user_id: userData.user.id,
        content,
        parent_id: parentId,
      })
    if (insertError) {
      setCommentsError(insertError.message)
      setReplySubmitting(false)
      return
    }
    setReplyContent("")
    setReplyingToId(null)
    await fetchComments()
    setReplySubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Commentaires</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              ref={commentTextareaRef}
              value={commentValue}
              onChange={(event) => setCommentValue(event.target.value)}
              onFocus={() => setCommentInputFocused(true)}
              onBlur={() =>
                setTimeout(() => {
                  if (!commentValue.trim()) setCommentInputFocused(false)
                }, 200)
              }
              placeholder="Ajouter un commentaire..."
              rows={2}
              className="min-h-10 resize-none"
            />
            {(commentInputFocused || commentValue.trim()) && (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCommentValue("")
                    setCommentInputFocused(false)
                    commentTextareaRef.current?.blur()
                  }}
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmitComment}
                  disabled={commentSubmitting || !commentValue.trim()}
                >
                  Publier
                </Button>
              </div>
            )}
            {commentsError && (
              <p className="text-sm text-destructive">{commentsError}</p>
            )}
            {commentsLoading && (
              <p className="text-sm text-muted-foreground">
                Chargement des commentaires...
              </p>
            )}
            {!commentsLoading && comments.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun commentaire pour le moment.
              </p>
            )}
            <div className="space-y-3">
              {comments.map((comment) => (
                <CommentBlock
                  key={comment.id}
                  comment={comment}
                  depth={0}
                  getUserMeta={getUserMeta}
                  relativeTime={relativeTime}
                  isAuthor={isAuthor}
                  currentUserId={currentUserId}
                  replyingToId={replyingToId}
                  setReplyingToId={setReplyingToId}
                  replyContent={replyContent}
                  setReplyContent={setReplyContent}
                  replySubmitting={replySubmitting}
                  onToggleSolution={handleToggleSolution}
                  onVote={handleCommentVote}
                  onSubmitReply={handleSubmitReply}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
