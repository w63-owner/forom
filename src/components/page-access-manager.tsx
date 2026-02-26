"use client"

import { useEffect, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  Check,
  Copy,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { useToast } from "@/components/ui/toast"
import { isAbortLikeError } from "@/lib/async-resilience"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"

type Props = {
  pageId: string
  ownerId: string
}

type Member = {
  user_id: string
  role: "admin" | "viewer"
  users?:
    | { username: string | null; email: string | null; avatar_url?: string | null }
    | { username: string | null; email: string | null; avatar_url?: string | null }[]
    | null
}

export function PageAccessManager({ pageId, ownerId }: Props) {
  const t = useTranslations("PrivatePages")
  const tCommon = useTranslations("Common")
  const locale = useLocale()
  const { showToast } = useToast()
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const loadSeqRef = useRef(0)

  const loadMembers = async (attempt = 1) => {
    const loadSeq = ++loadSeqRef.current
    try {
      const response = await fetch(
        `/api/pages/members/list?pageId=${encodeURIComponent(pageId)}`,
        { cache: "no-store" }
      )
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; members?: Member[]; error?: string }
        | null

      if (attempt < 2 && response.status === 401) {
        const supabase = getSupabaseClient()
        if (supabase) {
          await resolveAuthUser(supabase, {
            timeoutMs: 3500,
            includeServerFallback: true,
          }).catch(() => null)
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
        if (loadSeq === loadSeqRef.current) {
          await loadMembers(attempt + 1)
        }
        return
      }

      if (!response.ok || !payload?.ok) {
        setMembers([])
        setError(payload?.error ?? t("loadError"))
      } else {
        setMembers(payload.members ?? [])
        setError(null)
      }
    } catch (err) {
      if (!isAbortLikeError(err)) {
        setError(t("loadError"))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMembers()
  }, [pageId])

  const ensureInviteUrl = async (): Promise<string | null> => {
    if (inviteUrl) return inviteUrl
    setGenerating(true)
    setError(null)
    const response = await fetch("/api/pages/invitations/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, expiresInHours: 72, maxUses: 20 }),
    })
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; inviteUrl?: string; error?: string }
      | null
    if (!response.ok || !payload?.ok || !payload.inviteUrl) {
      setError(payload?.error ?? t("inviteCreateError"))
      setGenerating(false)
      return null
    }
    setInviteUrl(payload.inviteUrl)
    setGenerating(false)
    return payload.inviteUrl
  }

  const copyInvite = async () => {
    const url = await ensureInviteUrl()
    if (!url) return
    try {
      await navigator.clipboard.writeText(url.replace("/fr/", `/${locale}/`))
      setCopied(true)
      showToast({ variant: "success", title: t("inviteCopied") })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(t("copyError"))
    }
  }

  const removeMember = async (userId: string) => {
    setRemovingId(userId)
    setError(null)
    const response = await fetch("/api/pages/members/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, userId }),
    })
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null
    if (!response.ok || !payload?.ok) {
      setError(payload?.error ?? t("memberRemoveError"))
      setRemovingId(null)
      return
    }
    showToast({ variant: "success", title: t("memberRemoved") })
    setRemovingId(null)
    void loadMembers()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="size-4.5 text-primary" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
              {t("visibilityPrivate")}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {t("privateHint")}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
          <X className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Members */}
      {loading ? (
        <div className="space-y-3">
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="h-12 animate-pulse rounded-lg bg-muted/60" />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("members")}
            </p>
            {members.length > 0 && (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {members.length}
              </span>
            )}
          </div>
          {members.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border py-5">
              <Users className="size-5 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">{t("noMembers")}</p>
              <p className="px-6 text-center text-[11px] leading-relaxed text-muted-foreground/70">
                {t("noMembersHint")}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {members.map((member) => {
                const user = Array.isArray(member.users)
                  ? member.users[0] ?? null
                  : member.users ?? null
                const label = user?.username || user?.email || member.user_id
                return (
                  <div
                    key={member.user_id}
                    className="group flex items-center gap-2.5 rounded-lg border border-border bg-background p-2.5 transition-colors hover:bg-muted/30"
                  >
                    <Avatar
                      size="sm"
                      src={user?.avatar_url}
                      name={label}
                      seed={member.user_id}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {label}
                      </p>
                      <p className="text-[11px] capitalize text-muted-foreground">
                        {member.role}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                      disabled={removingId === member.user_id}
                      onClick={() => removeMember(member.user_id)}
                    >
                      <Trash2 className="size-3" />
                      <span className="sr-only sm:not-sr-only">
                        {tCommon("remove")}
                      </span>
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Sticky copy button at bottom */}
      <div className="sticky -bottom-5 -mx-5 border-t border-border bg-background px-5 py-3">
        <Button
          size="sm"
          className="w-full gap-1.5"
          disabled={generating}
          onClick={copyInvite}
        >
          {copied ? (
            <Check className="size-3.5 text-emerald-300" />
          ) : generating ? (
            <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? t("copiedLabel") : generating ? t("inviteGenerating") : t("copyInviteLink")}
        </Button>
      </div>
    </div>
  )
}
