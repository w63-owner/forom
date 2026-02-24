"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Heart, ThumbsDown, ThumbsUp } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"
import { relativeTime } from "@/lib/utils"

type Props = {
  propositionId: string
  propositionAuthorId: string | null
  propositionAuthorAvatarUrl?: string | null
  propositionAuthorName?: string | null
}

const isAbortLikeError = (value: unknown): boolean => {
  if (value instanceof DOMException && value.name === "AbortError") return true
  if (value instanceof Error) {
    const message = value.message.toLowerCase()
    return (
      message.includes("aborterror") ||
      message.includes("signal is aborted") ||
      message.includes("aborted without reason")
    )
  }
  if (typeof value === "string") {
    const message = value.toLowerCase()
    return (
      message.includes("aborterror") ||
      message.includes("signal is aborted") ||
      message.includes("aborted without reason")
    )
  }
  return false
}

type CommentItem = {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_id?: string | null
  is_solution?: boolean | null
  users?:
    | { username: string | null; email: string | null; avatar_url?: string | null }
    | { username: string | null; email: string | null; avatar_url?: string | null }[]
    | null
  replies?: CommentItem[]
  votesCount?: number
  currentUserVote?: "Upvote" | "Downvote" | null
  likedByAuthor?: boolean
}

type CommentBlockProps = {
  comment: CommentItem
  depth: number
  getUserMeta: (
    users:
      | { username: string | null; email: string | null; avatar_url?: string | null }
      | { username: string | null; email: string | null; avatar_url?: string | null }[]
      | null
      | undefined
  ) => { username: string | null; email: string | null; avatar_url?: string | null } | null
  relativeTime: (dateStr: string) => string
  isAuthor: boolean
  currentUserId: string | null
  replyingToId: string | null
  setReplyingToId: (id: string | null) => void
  replyContent: string
  setReplyContent: (v: string) => void
  replySubmitting: boolean
  onToggleSolution: (commentId: string, nextValue: boolean) => void
  onVote: (
    commentId: string,
    type: "Upvote" | "Downvote",
    currentVote: "Upvote" | "Downvote" | null
  ) => void
  onSubmitReply: (parentId: string) => void
  propositionAuthorAvatarUrl: string | null
  propositionAuthorName: string | null
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
  propositionAuthorAvatarUrl,
  propositionAuthorName,
}: CommentBlockProps) {
  const meta = getUserMeta(comment.users)
  const t = useTranslations("PropositionComments")
  const username = meta?.username || meta?.email || t("anonymous")
  const isReplying = replyingToId === comment.id
  const indent = depth > 0 ? "pl-6 border-l-2 border-border/60" : ""
  const contentOffset = !comment.is_solution ? "ml-[4.25rem]" : ""

  return (
    <div className={`py-3 ${indent}`}>
      {!comment.is_solution && (
        <div className="flex items-start gap-3">
          <Avatar
            size="lg"
            src={meta?.avatar_url ?? null}
            name={username}
            className="mt-0.5 h-14 w-14 shrink-0 text-sm"
          />
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-baseline gap-1.5 text-sm">
              <span className="font-semibold text-foreground">@{username}</span>
              <span className="text-muted-foreground font-normal">
                {relativeTime(comment.created_at)}
              </span>
            </p>
            <p className="mt-1 text-sm text-foreground">{comment.content}</p>
          </div>
        </div>
      )}
      {comment.is_solution ? (
        <div className="mt-2">
          <Alert variant="success" title={t("solutionAccepted")}>
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{username}</span>
              <span className="ml-1.5">{relativeTime(comment.created_at)}</span>
            </div>
            <div className="text-sm text-foreground">{comment.content}</div>
          </Alert>
        </div>
      ) : null}
      <div className={`mt-2 flex flex-wrap items-center gap-2 ${contentOffset}`}>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            className={
              comment.currentUserVote === "Upvote"
                ? "text-primary"
                : "text-muted-foreground"
            }
            onClick={() =>
              currentUserId
                ? onVote(comment.id, "Upvote", comment.currentUserVote ?? null)
                : null
            }
            disabled={!currentUserId}
          >
            <ThumbsUp className="size-3" />
          </Button>
          <span className="min-w-[1.25rem] text-center text-xs text-muted-foreground">
            {Math.max(0, comment.votesCount ?? 0)}
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
              currentUserId
                ? onVote(comment.id, "Downvote", comment.currentUserVote ?? null)
                : null
            }
            disabled={!currentUserId}
          >
            <ThumbsDown className="size-3" />
          </Button>
        </div>
        {comment.likedByAuthor ? (
          <span
            title="Liked by proposition author"
            aria-label="Liked by proposition author"
            className="relative inline-flex h-6 w-6 items-center justify-center"
          >
            <Avatar
              size="sm"
              src={propositionAuthorAvatarUrl}
              name={propositionAuthorName ?? "Author"}
              className="h-6 w-6 border border-border"
            />
            <span className="absolute -bottom-1 -right-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 ring-2 ring-background">
              <Heart className="size-2 fill-white text-white" />
            </span>
          </span>
        ) : null}
        {currentUserId && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              const targetId = comment.parent_id ?? comment.id
              setReplyingToId(replyingToId === targetId ? null : targetId)
            }}
          >
            {t("reply")}
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
            {comment.is_solution ? t("unmarkSolution") : t("markSolution")}
          </Button>
        )}
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className={`mt-3 space-y-1 ${contentOffset}`}>
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
              propositionAuthorAvatarUrl={propositionAuthorAvatarUrl}
              propositionAuthorName={propositionAuthorName ?? "Author"}
            />
          ))}
        </div>
      )}
      {isReplying && (
        <div className={`mt-3 space-y-2 ${contentOffset}`}>
          <Textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder={t("replyPlaceholder")}
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
              {t("cancel")}
            </Button>
            <Button
              size="sm"
              onClick={() => onSubmitReply(comment.parent_id ?? comment.id)}
              disabled={replySubmitting || !replyContent.trim()}
            >
              {t("post")}
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
  propositionAuthorAvatarUrl = null,
  propositionAuthorName = "Author",
}: Props) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("PropositionComments")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [commentValue, setCommentValue] = useState("")
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentInputFocused, setCommentInputFocused] = useState(false)
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const commentSubmitInProgressRef = useRef(false)
  const replySubmitInProgressRef = useRef(false)
  const currentUserIdRef = useRef<string | null>(null)
  const commentsInitialLoadDoneRef = useRef(false)
  const fetchCommentsRef = useRef<() => void>(() => {})
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [replySubmitting, setReplySubmitting] = useState(false)

  const relativeTimeLabel = (dateStr: string) =>
    relativeTime(dateStr, locale)

  const getUserMeta = (
    users:
      | { username: string | null; email: string | null; avatar_url?: string | null }
      | { username: string | null; email: string | null; avatar_url?: string | null }[]
      | null
      | undefined
  ): { username: string | null; email: string | null; avatar_url?: string | null } | null =>
    (Array.isArray(users) ? users[0] : users) ?? null

  const isAuthor =
    Boolean(currentUserId) &&
    Boolean(propositionAuthorId) &&
    currentUserId === propositionAuthorId

  useEffect(() => {
    const loadCurrentUser = async () => {
      const supabase = getSupabaseClient()
      if (!supabase) return
      const user = await resolveAuthUser(supabase, {
        timeoutMs: 3500,
        includeServerFallback: true,
      })
      setCurrentUserId(user?.id ?? null)
    }
    void loadCurrentUser()
  }, [])

  const fetchComments = useCallback(async () => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setCommentsError(t("supabaseNotConfigured"))
      setCommentsLoading(false)
      return
    }
    if (!commentsInitialLoadDoneRef.current) {
      setCommentsLoading(true)
    }
    setCommentsError(null)
    const userId = currentUserIdRef.current
    try {
      const { data: rawComments, error: commentsError } = await supabase
        .from("comments")
        .select(
          "id, content, created_at, user_id, parent_id, is_solution, users!user_id(username, email, avatar_url)"
        )
        .eq("proposition_id", propositionId)
        .order("created_at", { ascending: false })
      if (commentsError) {
        if (isAbortLikeError(commentsError.message)) {
          return
        }
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
        { count: number; userVote: "Upvote" | "Downvote" | null; likedByAuthor: boolean }
      >()
      for (const id of ids) {
        votesByComment.set(id, { count: 0, userVote: null, likedByAuthor: false })
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
        const actorIds = [userId, propositionAuthorId].filter(
          (id): id is string => Boolean(id)
        )
        if (actorIds.length > 0) {
          const { data: actorVotes } = await supabase
            .from("comment_votes")
            .select("comment_id, type, user_id")
            .in("comment_id", ids)
            .in("user_id", actorIds)
          for (const row of actorVotes ?? []) {
            const cur = votesByComment.get(row.comment_id)
            if (!cur) continue
            if (userId && row.user_id === userId) {
              cur.userVote = row.type as "Upvote" | "Downvote"
            }
            if (
              propositionAuthorId &&
              row.user_id === propositionAuthorId &&
              row.type === "Upvote"
            ) {
              cur.likedByAuthor = true
            }
          }
        }
      }
      const withVotes = list.map((c) => ({
        ...c,
        votesCount: votesByComment.get(c.id)?.count ?? 0,
        currentUserVote: votesByComment.get(c.id)?.userVote ?? null,
        likedByAuthor: votesByComment.get(c.id)?.likedByAuthor ?? false,
      }))
      const buildTree = (
        items: CommentItem[],
        parentId: string | null
      ): CommentItem[] =>
        items
          .filter((c) => (c.parent_id ?? null) === parentId)
          .sort((a, b) => {
            const aSolution = Boolean(a.is_solution)
            const bSolution = Boolean(b.is_solution)
            if (aSolution !== bSolution) {
              return aSolution ? -1 : 1
            }
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
      if (isAbortLikeError(err)) {
        return
      }
      setCommentsError(
        err instanceof Error ? err.message : t("loadError")
      )
      setComments([])
    } finally {
      commentsInitialLoadDoneRef.current = true
      setCommentsLoading(false)
    }
  }, [propositionId, t])

  useEffect(() => {
    commentsInitialLoadDoneRef.current = false
    const timeout = setTimeout(() => {
      void fetchComments()
    }, 0)
    return () => clearTimeout(timeout)
  }, [fetchComments])

  useEffect(() => {
    currentUserIdRef.current = currentUserId
  }, [currentUserId])

  useEffect(() => {
    fetchCommentsRef.current = fetchComments
  }, [fetchComments])

  useEffect(() => {
    if (currentUserId !== null) {
      fetchCommentsRef.current()
    }
  }, [currentUserId])

  const handleSubmitComment = async () => {
    if (!commentValue.trim()) return
    if (commentSubmitInProgressRef.current) return
    commentSubmitInProgressRef.current = true
    setCommentSubmitting(true)
    setCommentsError(null)

    const supabase = getSupabaseClient()
    if (!supabase) {
      setCommentsError(t("supabaseNotConfigured"))
      setCommentSubmitting(false)
      commentSubmitInProgressRef.current = false
      return
    }

    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (!user) {
      commentSubmitInProgressRef.current = false
      setCommentSubmitting(false)
      router.push(
        `/${locale}/propositions/${propositionId}?auth=signup&next=${encodeURIComponent(`/${locale}/propositions/${propositionId}`)}`
      )
      return
    }
    try {
      const { data: insertedComment, error: insertError } = await supabase
      .from("comments")
      .insert({
        proposition_id: propositionId,
        user_id: user.id,
        content: commentValue.trim(),
      })
      .select("id")
      .single()

    if (insertError) {
      setCommentsError(insertError.message)
      setCommentSubmitting(false)
      commentSubmitInProgressRef.current = false
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
        actorUserId: user.id,
        locale,
      }),
    }).catch(() => null)
  } finally {
    setCommentSubmitting(false)
    commentSubmitInProgressRef.current = false
  }
  }

  const handleToggleSolution = async (commentId: string, nextValue: boolean) => {
    if (!isAuthor) return
    const supabase = getSupabaseClient()
    if (!supabase) {
      setCommentsError(t("supabaseNotConfigured"))
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
        locale,
      }),
    }).catch(() => null)
  }

  const handleCommentVote = async (
    commentId: string,
    type: "Upvote" | "Downvote",
    currentVote: "Upvote" | "Downvote" | null
  ) => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (!user) {
      router.push(
        `/${locale}/propositions/${propositionId}?auth=signup&next=${encodeURIComponent(`/${locale}/propositions/${propositionId}`)}`
      )
      return
    }
    if (currentVote === type) {
      await supabase
        .from("comment_votes")
        .delete()
        .eq("user_id", user.id)
        .eq("comment_id", commentId)
    } else {
      await supabase.from("comment_votes").upsert(
        {
          user_id: user.id,
          comment_id: commentId,
          type,
        },
        { onConflict: "user_id,comment_id" }
      )
    }
    await fetchComments()
  }

  const handleSubmitReply = async (parentId: string) => {
    const content = replyContent.trim()
    if (!content) return
    if (replySubmitInProgressRef.current) return
    replySubmitInProgressRef.current = true
    setReplySubmitting(true)
    setCommentsError(null)

    const supabase = getSupabaseClient()
    if (!supabase) {
      setCommentsError(t("supabaseNotConfigured"))
      setReplySubmitting(false)
      replySubmitInProgressRef.current = false
      return
    }
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (!user) {
      replySubmitInProgressRef.current = false
      setReplySubmitting(false)
      router.push(
        `/${locale}/propositions/${propositionId}?auth=signup&next=${encodeURIComponent(`/${locale}/propositions/${propositionId}`)}`
      )
      return
    }
    try {
      const { error: insertError } = await supabase
        .from("comments")
        .insert({
          proposition_id: propositionId,
          user_id: user.id,
          content,
          parent_id: parentId,
        })
      if (insertError) {
        setCommentsError(insertError.message)
        return
      }
      setReplyContent("")
      setReplyingToId(null)
      await fetchComments()
    } finally {
      setReplySubmitting(false)
      replySubmitInProgressRef.current = false
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("title")}</CardTitle>
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
              placeholder={t("addCommentPlaceholder")}
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
                  {t("cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmitComment}
                  disabled={commentSubmitting || !commentValue.trim()}
                >
                  {t("post")}
                </Button>
              </div>
            )}
            {commentsError && (
              <p className="text-sm text-destructive">{commentsError}</p>
            )}
            {commentsLoading && (
              <p className="text-sm text-muted-foreground">
                {t("loadingComments")}
              </p>
            )}
            {!commentsLoading && comments.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("noComments")}
              </p>
            )}
            <div className="space-y-3">
              {comments.map((comment) => (
                <CommentBlock
                  key={comment.id}
                  comment={comment}
                  depth={0}
                  getUserMeta={getUserMeta}
                  relativeTime={relativeTimeLabel}
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
                  propositionAuthorAvatarUrl={propositionAuthorAvatarUrl}
                  propositionAuthorName={propositionAuthorName ?? "Author"}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}