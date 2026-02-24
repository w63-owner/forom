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
import { useAuthModal } from "@/components/auth-modal-provider"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"
import { relativeTime } from "@/lib/utils"

type Props = {
  propositionId: string
  propositionAuthorId: string | null
  propositionAuthorAvatarUrl?: string | null
  propositionAuthorName?: string | null
}

type CommentsLoadState = "idle" | "loading" | "loaded" | "empty" | "error"

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
  onRequireAuth: () => void
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
  onRequireAuth,
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
            onClick={() => {
              if (!currentUserId) {
                onRequireAuth()
                return
              }
              onVote(comment.id, "Upvote", comment.currentUserVote ?? null)
            }}
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
            onClick={() => {
              if (!currentUserId) {
                onRequireAuth()
                return
              }
              onVote(comment.id, "Downvote", comment.currentUserVote ?? null)
            }}
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
        <Button
          variant="ghost"
          size="xs"
          onClick={() => {
            if (!currentUserId) {
              onRequireAuth()
              return
            }
            const targetId = comment.parent_id ?? comment.id
            setReplyingToId(replyingToId === targetId ? null : targetId)
          }}
        >
          {t("reply")}
        </Button>
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
  const { openAuthModal } = useAuthModal()
  const t = useTranslations("PropositionComments")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [commentsLoadState, setCommentsLoadState] =
    useState<CommentsLoadState>("idle")
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [commentValue, setCommentValue] = useState("")
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentInputFocused, setCommentInputFocused] = useState(false)
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const commentSubmitInProgressRef = useRef(false)
  const replySubmitInProgressRef = useRef(false)
  const commentsInitialLoadDoneRef = useRef(false)
  const fetchCommentsRef = useRef<() => void>(() => {})
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [replySubmitting, setReplySubmitting] = useState(false)
  const commentsRequestSeqRef = useRef(0)

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

  const openAuthForThisProposition = useCallback(() => {
    openAuthModal("signup", `/${locale}/propositions/${propositionId}`)
  }, [locale, openAuthModal, propositionId])

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
    const requestSeq = ++commentsRequestSeqRef.current
    const requestId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `comments-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const withTimeoutFetch = async (
      timeoutMs: number,
      attempt: number,
      timeoutCount: number
    ): Promise<Response> => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort("comments_timeout"), timeoutMs)
      try {
        return await fetch(`/api/comments/thread?propositionId=${propositionId}`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
          headers: {
            "x-comments-client": "proposition-detail",
            "x-comments-request-id": requestId,
            "x-comments-attempt": String(attempt),
            "x-comments-timeouts": String(timeoutCount),
          },
        })
      } finally {
        clearTimeout(timeoutId)
      }
    }
    const fetchWithRetry = async (): Promise<Response> => {
      let lastError: unknown = null
      const baseTimeoutMs = 8000
      let timeoutCount = 0
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await withTimeoutFetch(
            baseTimeoutMs + attempt * 3000,
            attempt + 1,
            timeoutCount
          )
        } catch (error) {
          lastError = error
          if (isAbortLikeError(error)) {
            timeoutCount += 1
          }
          if (!isAbortLikeError(error) || attempt === 2) {
            throw error
          }
          await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt))
        }
      }
      throw lastError instanceof Error ? lastError : new Error("comments_fetch_timeout")
    }

    if (!commentsInitialLoadDoneRef.current) {
      setCommentsLoadState("loading")
    }
    setCommentsError(null)
    try {
      const response = await fetchWithRetry()
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; comments?: CommentItem[] }
        | null
      if (!response.ok || !payload?.ok) {
        setCommentsError(t("loadError"))
        setComments([])
        setCommentsLoadState("error")
        return
      }
      const withVotes = (payload.comments ?? []) as CommentItem[]
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
      if (requestSeq !== commentsRequestSeqRef.current) return
      setComments(withReplies)
      setCommentsLoadState(withReplies.length > 0 ? "loaded" : "empty")
    } catch (err) {
      if (requestSeq !== commentsRequestSeqRef.current) return
      if (isAbortLikeError(err)) {
        setCommentsError(t("loadError"))
        setComments([])
        setCommentsLoadState("error")
        return
      }
      setCommentsError(t("loadError"))
      setComments([])
      setCommentsLoadState("error")
    } finally {
      commentsInitialLoadDoneRef.current = true
    }
  }, [propositionId, t])

  useEffect(() => {
    commentsInitialLoadDoneRef.current = false
    void fetchComments()
  }, [fetchComments])

  useEffect(() => {
    fetchCommentsRef.current = fetchComments
  }, [fetchComments])

  useEffect(() => {
    if (currentUserId !== null) {
      fetchCommentsRef.current()
    }
  }, [currentUserId])

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) return

    let pollId: ReturnType<typeof setInterval> | null = null
    const startFallbackPolling = () => {
      if (pollId) return
      pollId = setInterval(() => {
        fetchCommentsRef.current()
      }, 20000)
    }

    const channel = supabase
      .channel(`comments:${propositionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `proposition_id=eq.${propositionId}`,
        },
        () => {
          fetchCommentsRef.current()
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          startFallbackPolling()
        }
      })

    return () => {
      if (pollId) clearInterval(pollId)
      supabase.removeChannel(channel).catch(() => null)
    }
  }, [propositionId])

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
      const response = await fetch("/api/comments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propositionId,
          content: commentValue.trim(),
        }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; commentId?: string }
        | null
      if (!response.ok || !payload?.ok) {
        setCommentsError(t("loadError"))
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
          commentId: payload.commentId,
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
    setCommentsError(null)
    const response = await fetch("/api/comments/solution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propositionId, commentId, nextValue }),
    })
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null
    if (!response.ok || !payload?.ok) {
      setCommentsError(t("loadError"))
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
    if (!supabase) {
      setCommentsError(t("supabaseNotConfigured"))
      return
    }
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
    const response = await fetch("/api/comments/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propositionId, commentId, type, currentVote }),
    })
    if (!response.ok) {
      setCommentsError(t("loadError"))
      return
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
      const response = await fetch("/api/comments/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propositionId,
          content,
          parentId,
        }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; commentId?: string }
        | null
      if (!response.ok || !payload?.ok) {
        setCommentsError(t("loadError"))
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
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-destructive">{commentsError}</p>
                <Button
                  variant="outline"
                  size="xs"
                  className="h-7"
                  onClick={() => void fetchComments()}
                >
                  {t("retry")}
                </Button>
              </div>
            )}
            {commentsLoadState === "loading" && (
              <p className="text-sm text-muted-foreground">
                {t("loadingComments")}
              </p>
            )}
            {commentsLoadState === "empty" && (
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
                  onRequireAuth={openAuthForThisProposition}
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