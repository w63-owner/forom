"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { FileText, Heart, Lightbulb, ThumbsDown, ThumbsUp } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { useAuthModal } from "@/components/auth-modal-provider"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"
import { relativeTime } from "@/lib/utils"
import {
  buildCommentTree,
  deriveInitialCommentsLoadState,
  type CommentsLoadState,
  type EnrichedThreadComment,
} from "@/lib/comments/thread-loader"
import type { ReactNode } from "react"

type Props = {
  propositionId: string
  propositionAuthorId: string | null
  propositionAuthorAvatarUrl?: string | null
  propositionAuthorName?: string | null
  initialComments?: EnrichedThreadComment[]
}

type OmnibarResult = {
  propositions?: Array<{ id: string; title: string | null }>
  pages?: Array<{ id: string; name: string | null; slug: string | null }>
}

type MentionOption = {
  id: string
  kind: "page" | "proposition"
  label: string
  href: string
}

const SVG_NS = "http://www.w3.org/2000/svg"

const createMentionChipIcon = (kind: MentionOption["kind"]): SVGSVGElement => {
  const svg = document.createElementNS(SVG_NS, "svg")
  svg.setAttribute("xmlns", SVG_NS)
  svg.setAttribute("viewBox", "0 0 24 24")
  svg.setAttribute("width", "14")
  svg.setAttribute("height", "14")
  svg.setAttribute("fill", "none")
  svg.setAttribute("stroke", "currentColor")
  svg.setAttribute("stroke-width", "2")
  svg.setAttribute("stroke-linecap", "round")
  svg.setAttribute("stroke-linejoin", "round")
  svg.setAttribute(
    "class",
    kind === "proposition"
      ? "lucide lucide-lightbulb size-3.5 shrink-0 text-white/90"
      : "lucide lucide-file-text size-3.5 shrink-0 text-white/90"
  )
  svg.setAttribute("aria-hidden", "true")

  const paths =
    kind === "proposition"
      ? ["M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5", "M9 18h6", "M10 22h4"]
      : [
          "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",
          "M14 2v5a1 1 0 0 0 1 1h5",
          "M10 9H8",
          "M16 13H8",
          "M16 17H8",
        ]

  paths.forEach((d) => {
    const path = document.createElementNS(SVG_NS, "path")
    path.setAttribute("d", d)
    svg.appendChild(path)
  })

  return svg
}

const getEditorTextBeforeCaret = (root: HTMLElement): string => {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return ""
  const range = selection.getRangeAt(0)
  const preRange = range.cloneRange()
  preRange.selectNodeContents(root)
  preRange.setEnd(range.endContainer, range.endOffset)
  return preRange.toString()
}

const getNodeAtTextOffset = (root: HTMLElement, offset: number) => {
  if (offset <= 0) {
    return { node: root, offset: 0 }
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let currentOffset = 0
  let current = walker.nextNode()
  while (current) {
    const value = current.textContent ?? ""
    const nextOffset = currentOffset + value.length
    if (offset <= nextOffset) {
      return { node: current, offset: offset - currentOffset }
    }
    currentOffset = nextOffset
    current = walker.nextNode()
  }
  return { node: root, offset: root.childNodes.length }
}

const serializeCommentEditorContent = (root: HTMLElement): string => {
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? ""
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return ""
    }
    const element = node as HTMLElement
    if (element.dataset.mentionChip === "true") {
      const rawLabel = (element.textContent ?? "").trim()
      const label = rawLabel.replace(/^[💡📄]\s*/, "")
      const href = (element.dataset.href ?? "").trim()
      if (!label || !href) return label
      return `[${label}](${href})`
    }
    if (element.tagName === "BR") return "\n"

    const childText = Array.from(element.childNodes)
      .map((child) => walk(child))
      .join("")
    if (element.tagName === "DIV" || element.tagName === "P") {
      return `${childText}\n`
    }
    return childText
  }

  const raw = Array.from(root.childNodes)
    .map((child) => walk(child))
    .join("")
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
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

type CommentItem = EnrichedThreadComment

const countCommentsRecursive = (items: CommentItem[]): number =>
  items.reduce((total, item) => total + 1 + countCommentsRecursive(item.replies ?? []), 0)

const linkifyPlainTextUrls = (content: string, keyPrefix: string) => {
  const tokenPattern = /(https?:\/\/[^\s]+|\/(?:fr|en)\/[^\s]+)/g
  const parts = content.split(tokenPattern)
  return parts.map((part, index) => {
    const isHttp = /^https?:\/\//.test(part)
    const isInternal = /^\/(?:fr|en)\//.test(part)
    if (!isHttp && !isInternal) return <span key={`${keyPrefix}-txt-${index}`}>{part}</span>
    return (
      <a
        key={`${keyPrefix}-lnk-${index}`}
        href={part}
        className="text-primary underline underline-offset-2 hover:opacity-90"
        target={isHttp ? "_blank" : undefined}
        rel={isHttp ? "noopener noreferrer" : undefined}
      >
        {part}
      </a>
    )
  })
}

const renderCommentContent = (content: string) => {
  const markdownLinkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/(?:fr|en)\/[^\s)]+)\)/g
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null = null
  let segmentIndex = 0

  while ((match = markdownLinkPattern.exec(content)) !== null) {
    const fullMatch = match[0]
    const label = (match[1] ?? "").trim()
    const href = (match[2] ?? "").trim()
    const start = match.index

    if (start > lastIndex) {
      const plainPart = content.slice(lastIndex, start)
      nodes.push(...linkifyPlainTextUrls(plainPart, `plain-${segmentIndex}`))
      segmentIndex += 1
    }

    if (label && href) {
      const isHttp = /^https?:\/\//.test(href)
      const isMentionLabel = /^([💡📄]\s*)?@/.test(label)
      const mentionKind =
        href.includes("/propositions/") ? "proposition" : href.includes("/pages/") ? "page" : null
      nodes.push(
        <a
          key={`md-${segmentIndex}`}
          href={href}
          className={
            isMentionLabel
              ? "mx-0.5 inline-flex max-w-full items-center gap-1.5 rounded-md border border-white/8 bg-black/70 px-2.5 py-0.5 text-xs text-white/92 shadow-[0_1px_6px_rgba(0,0,0,0.24)] backdrop-blur-xl align-baseline hover:bg-black/75"
              : "text-primary underline underline-offset-2 hover:opacity-90"
          }
          target={isHttp ? "_blank" : undefined}
          rel={isHttp ? "noopener noreferrer" : undefined}
        >
          {isMentionLabel && mentionKind === "proposition" ? (
            <Lightbulb className="lucide lucide-lightbulb size-3.5 shrink-0 text-white/90" />
          ) : null}
          {isMentionLabel && mentionKind === "page" ? (
            <FileText className="lucide lucide-file-text size-3.5 shrink-0 text-white/90" />
          ) : null}
          <span className={isMentionLabel ? "truncate" : undefined}>{label}</span>
        </a>
      )
      segmentIndex += 1
    } else {
      nodes.push(...linkifyPlainTextUrls(fullMatch, `fallback-${segmentIndex}`))
      segmentIndex += 1
    }

    lastIndex = start + fullMatch.length
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex)
    nodes.push(...linkifyPlainTextUrls(remaining, `tail-${segmentIndex}`))
  }

  return nodes
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
            <p className="mt-1 break-words text-sm text-foreground">
              {renderCommentContent(comment.content)}
            </p>
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
            <div className="break-words text-sm text-foreground">
              {renderCommentContent(comment.content)}
            </div>
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
              onRequireAuth={onRequireAuth}
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
  initialComments = [],
}: Props) {
  const router = useRouter()
  const locale = useLocale()
  const { openAuthModal } = useAuthModal()
  const t = useTranslations("PropositionComments")
  const hasInitialComments = initialComments.length > 0
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [comments, setComments] = useState<CommentItem[]>(initialComments)
  const [commentsLoadState, setCommentsLoadState] =
    useState<CommentsLoadState>(deriveInitialCommentsLoadState(initialComments))
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [commentValue, setCommentValue] = useState("")
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentInputFocused, setCommentInputFocused] = useState(false)
  const [commentMentionOpen, setCommentMentionOpen] = useState(false)
  const [commentMentionOptions, setCommentMentionOptions] = useState<MentionOption[]>([])
  const [commentMentionActiveIndex, setCommentMentionActiveIndex] = useState(0)
  const [commentMentionLoading, setCommentMentionLoading] = useState(false)
  const commentEditorRef = useRef<HTMLDivElement | null>(null)
  const commentMentionRangeRef = useRef<{ start: number; end: number } | null>(null)
  const commentMentionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commentMentionAbortRef = useRef<AbortController | null>(null)
  const commentSubmitInProgressRef = useRef(false)
  const replySubmitInProgressRef = useRef(false)
  const commentsInitialLoadDoneRef = useRef(hasInitialComments)
  const initialBackgroundRefreshScheduledRef = useRef(false)
  const fetchCommentsRef = useRef<() => void>(() => {})
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [replySubmitting, setReplySubmitting] = useState(false)
  const commentsRequestSeqRef = useRef(0)
  const totalComments = countCommentsRecursive(comments)

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

  const closeCommentMentions = useCallback(() => {
    setCommentMentionOpen(false)
    setCommentMentionOptions([])
    setCommentMentionActiveIndex(0)
    setCommentMentionLoading(false)
    commentMentionRangeRef.current = null
    commentMentionAbortRef.current?.abort()
    commentMentionAbortRef.current = null
    if (commentMentionDebounceRef.current) {
      clearTimeout(commentMentionDebounceRef.current)
      commentMentionDebounceRef.current = null
    }
  }, [])

  const fetchCommentMentionOptions = useCallback(
    async (query: string) => {
      commentMentionAbortRef.current?.abort()
      const controller = new AbortController()
      commentMentionAbortRef.current = controller
      setCommentMentionLoading(true)
      try {
        const response = await fetch(`/api/omnibar/search?q=${encodeURIComponent(query)}`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        })
        if (!response.ok) {
          setCommentMentionOptions([])
          setCommentMentionActiveIndex(0)
          return
        }
        const payload = (await response.json().catch(() => null)) as OmnibarResult | null
        const propositionOptions = (payload?.propositions ?? [])
          .filter((item) => Boolean(item?.id && item?.title))
          .map((item) => ({
            id: `proposition:${item.id}`,
            kind: "proposition" as const,
            label: item.title ?? "",
            href: `/${locale}/propositions/${item.id}`,
          }))
        const pageOptions = (payload?.pages ?? [])
          .filter((item) => Boolean(item?.slug && item?.name))
          .map((item) => ({
            id: `page:${item.id}`,
            kind: "page" as const,
            label: item.name ?? "",
            href: `/${locale}/pages/${item.slug}`,
          }))
        const options = [...propositionOptions, ...pageOptions].slice(0, 8)
        setCommentMentionOptions(options)
        setCommentMentionActiveIndex(0)
      } catch (error) {
        if (!isAbortLikeError(error)) {
          setCommentMentionOptions([])
          setCommentMentionActiveIndex(0)
        }
      } finally {
        setCommentMentionLoading(false)
      }
    },
    [locale]
  )

  const updateCommentMentionsFromInput = useCallback(() => {
      const root = commentEditorRef.current
      if (!root || !commentInputFocused) {
        closeCommentMentions()
        return
      }
      const beforeCaret = getEditorTextBeforeCaret(root)
      const mentionMatch = beforeCaret.match(/(^|\s)@([^\s@]*)$/)
      if (!mentionMatch) {
        closeCommentMentions()
        return
      }
      const query = mentionMatch[2] ?? ""
      const atIndex = beforeCaret.lastIndexOf("@")
      if (atIndex < 0) {
        closeCommentMentions()
        return
      }
      commentMentionRangeRef.current = {
        start: atIndex,
        end: beforeCaret.length,
      }
      setCommentMentionOpen(true)
      setCommentMentionActiveIndex(0)
      if (commentMentionDebounceRef.current) {
        clearTimeout(commentMentionDebounceRef.current)
      }
      if (!query.trim()) {
        setCommentMentionOptions([])
        setCommentMentionLoading(false)
        return
      }
      commentMentionDebounceRef.current = setTimeout(() => {
        void fetchCommentMentionOptions(query.trim())
      }, 180)
    }, [closeCommentMentions, commentInputFocused, fetchCommentMentionOptions])

  const insertCommentMention = useCallback(
    (option: MentionOption) => {
      const range = commentMentionRangeRef.current
      const editor = commentEditorRef.current
      if (!range || !editor) return
      const selection = window.getSelection()
      if (!selection) return
      const startPosition = getNodeAtTextOffset(editor, range.start)
      const endPosition = getNodeAtTextOffset(editor, range.end)
      const replaceRange = document.createRange()
      replaceRange.setStart(startPosition.node, startPosition.offset)
      replaceRange.setEnd(endPosition.node, endPosition.offset)
      const safeLabel = option.label.replace(/[\[\]]/g, "").trim()
      const mentionText = `@${safeLabel}`
      const chip = document.createElement("span")
      const label = document.createElement("span")
      label.className = "truncate"
      label.textContent = mentionText
      chip.appendChild(createMentionChipIcon(option.kind))
      chip.appendChild(label)
      chip.dataset.mentionChip = "true"
      chip.dataset.href = option.href
      chip.contentEditable = "false"
      chip.setAttribute("title", mentionText)
      chip.className =
        "mx-0.5 inline-flex max-w-full items-center gap-1.5 rounded-md border border-white/8 bg-black/70 px-2.5 py-0.5 text-xs text-white/92 shadow-[0_1px_6px_rgba(0,0,0,0.24)] backdrop-blur-xl align-baseline"
      const trailingSpace = document.createTextNode(" ")
      replaceRange.deleteContents()
      replaceRange.insertNode(trailingSpace)
      replaceRange.insertNode(chip)
      const caretRange = document.createRange()
      caretRange.setStartAfter(trailingSpace)
      caretRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(caretRange)
      setCommentValue(editor.innerText.replace(/\u00a0/g, " "))
      closeCommentMentions()
      editor.focus()
    },
    [closeCommentMentions]
  )

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
      const withReplies = buildCommentTree(withVotes)
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
    if (hasInitialComments) {
      initialBackgroundRefreshScheduledRef.current = true
      const timeout = setTimeout(() => {
        initialBackgroundRefreshScheduledRef.current = false
        void fetchComments()
      }, 600)
      return () => {
        initialBackgroundRefreshScheduledRef.current = false
        clearTimeout(timeout)
      }
    }
    commentsInitialLoadDoneRef.current = false
    void fetchComments()
  }, [fetchComments, hasInitialComments])

  useEffect(() => {
    fetchCommentsRef.current = fetchComments
  }, [fetchComments])

  useEffect(() => {
    if (currentUserId !== null) {
      if (hasInitialComments && initialBackgroundRefreshScheduledRef.current) {
        return
      }
      fetchCommentsRef.current()
    }
  }, [currentUserId, hasInitialComments])

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

  useEffect(() => {
    return () => {
      commentMentionAbortRef.current?.abort()
      if (commentMentionDebounceRef.current) {
        clearTimeout(commentMentionDebounceRef.current)
      }
    }
  }, [])

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
      const serializedContent = commentEditorRef.current
        ? serializeCommentEditorContent(commentEditorRef.current)
        : commentValue.trim()
      const response = await fetch("/api/comments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propositionId,
          content: serializedContent,
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
      if (commentEditorRef.current) {
        commentEditorRef.current.innerHTML = ""
        commentEditorRef.current.blur()
      }
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
            <CardTitle className="text-lg">
              {t("title")} ({totalComments})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <div className="rounded-md border border-input bg-transparent px-3 py-2 shadow-xs transition-[color,box-shadow] hover:border-primary/40 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/30">
                <div
                  ref={commentEditorRef}
                  contentEditable
                  role="textbox"
                  aria-multiline="true"
                  data-placeholder={t("addCommentPlaceholder")}
                  className="min-h-10 whitespace-pre-wrap break-words bg-transparent text-sm outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_[data-mention-chip='true']]:cursor-pointer"
                  onInput={(event) => {
                    const value = event.currentTarget.innerText.replace(/\u00a0/g, " ")
                    setCommentValue(value)
                    updateCommentMentionsFromInput()
                  }}
                  onClick={() => {
                    updateCommentMentionsFromInput()
                  }}
                  onKeyUp={() => {
                    updateCommentMentionsFromInput()
                  }}
                  onKeyDown={(event) => {
                    if (!commentMentionOpen) return
                    if (event.key === "Escape") {
                      event.preventDefault()
                      closeCommentMentions()
                      return
                    }
                    if (
                      (event.key === "ArrowDown" || event.key === "ArrowUp") &&
                      commentMentionOptions.length > 0
                    ) {
                      event.preventDefault()
                      setCommentMentionActiveIndex((current) => {
                        if (event.key === "ArrowDown") {
                          return (current + 1) % commentMentionOptions.length
                        }
                        return (
                          (current - 1 + commentMentionOptions.length) %
                          commentMentionOptions.length
                        )
                      })
                      return
                    }
                    if (
                      (event.key === "Enter" || event.key === "Tab") &&
                      commentMentionOptions.length > 0
                    ) {
                      event.preventDefault()
                      const selected =
                        commentMentionOptions[commentMentionActiveIndex] ??
                        commentMentionOptions[0]
                      if (selected) insertCommentMention(selected)
                    }
                  }}
                  onFocus={() => setCommentInputFocused(true)}
                  onBlur={() =>
                    setTimeout(() => {
                      closeCommentMentions()
                      if (!commentValue.trim()) setCommentInputFocused(false)
                    }, 150)
                  }
                />
              </div>
              {commentMentionOpen && (
                <div className="absolute left-0 top-[calc(100%+0.35rem)] z-20 w-full overflow-hidden rounded-md border border-border bg-card shadow-lg">
                  {commentMentionLoading ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Recherche...</p>
                  ) : commentMentionOptions.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      Tape un caractere apres @ pour chercher une page ou une proposition.
                    </p>
                  ) : (
                    <ul className="max-h-56 overflow-auto py-1">
                      {commentMentionOptions.map((option, index) => (
                        <li key={option.id}>
                          <button
                            type="button"
                            className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                              index === commentMentionActiveIndex
                                ? "bg-muted"
                                : "hover:bg-muted/60"
                            }`}
                            onMouseDown={(event) => {
                              event.preventDefault()
                              insertCommentMention(option)
                            }}
                          >
                            <span className="truncate text-foreground">@{option.label}</span>
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                              {option.kind === "page" ? (
                                <FileText className="size-4 shrink-0 text-muted-foreground" />
                              ) : (
                                <Lightbulb className="size-4 shrink-0 text-muted-foreground" />
                              )}
                              {option.kind === "page" ? "Page" : "Proposition"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            {(commentInputFocused || commentValue.trim()) && (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCommentValue("")
                    setCommentInputFocused(false)
                    if (commentEditorRef.current) {
                      commentEditorRef.current.innerHTML = ""
                      commentEditorRef.current.blur()
                    }
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