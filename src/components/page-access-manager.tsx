"use client"

import { useEffect, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"

type Props = {
  pageId: string
  ownerId: string
  initialVisibility: "public" | "private"
}

type Invitation = {
  id: string
  expires_at: string
  used_count: number
  max_uses: number | null
  revoked_at: string | null
}

type Member = {
  user_id: string
  role: "admin" | "viewer"
  users?:
    | { username: string | null; email: string | null; avatar_url?: string | null }
    | { username: string | null; email: string | null; avatar_url?: string | null }[]
    | null
}

export function PageAccessManager({ pageId, ownerId, initialVisibility }: Props) {
  const t = useTranslations("PrivatePages")
  const tCommon = useTranslations("Common")
  const locale = useLocale()
  const [visibility, setVisibility] = useState<"public" | "private">(initialVisibility)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const isPrivate = visibility === "private"

  const requireOwner = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) return null
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (!user || user.id !== ownerId) return null
    return user
  }

  const loadLists = async () => {
    const user = await requireOwner()
    if (!user) return
    const [invRes, membersRes] = await Promise.all([
      fetch(`/api/pages/invitations/list?pageId=${encodeURIComponent(pageId)}`, {
        cache: "no-store",
      }),
      fetch(`/api/pages/members/list?pageId=${encodeURIComponent(pageId)}`, {
        cache: "no-store",
      }),
    ])
    const invPayload = (await invRes.json().catch(() => null)) as
      | { ok?: boolean; invitations?: Invitation[]; error?: string }
      | null
    const membersPayload = (await membersRes.json().catch(() => null)) as
      | { ok?: boolean; members?: Member[]; error?: string }
      | null
    if (!invRes.ok || !invPayload?.ok) {
      setError(invPayload?.error ?? t("loadError"))
    } else {
      setInvitations(invPayload.invitations ?? [])
    }
    if (!membersRes.ok || !membersPayload?.ok) {
      setError(membersPayload?.error ?? t("loadError"))
    } else {
      setMembers(membersPayload.members ?? [])
    }
  }

  useEffect(() => {
    void loadLists()
  }, [pageId])

  const generateInvite = async () => {
    setLoading(true)
    setError(null)
    setStatus(null)
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
      setLoading(false)
      return
    }
    setInviteUrl(payload.inviteUrl)
    setStatus(t("inviteCreated"))
    setLoading(false)
    void loadLists()
  }

  const revokeInvite = async (invitationId: string) => {
    setLoading(true)
    setError(null)
    const response = await fetch("/api/pages/invitations/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId }),
    })
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null
    if (!response.ok || !payload?.ok) {
      setError(payload?.error ?? t("inviteRevokeError"))
      setLoading(false)
      return
    }
    setStatus(t("inviteRevoked"))
    setLoading(false)
    void loadLists()
  }

  const copyInvite = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setStatus(t("inviteCopied"))
    } catch {
      setError(t("copyError"))
    }
  }

  const updateVisibility = async (nextVisibility: "public" | "private") => {
    if (nextVisibility === visibility) return
    if (
      nextVisibility === "public" &&
      !window.confirm(t("confirmMakePublic"))
    ) {
      return
    }
    setLoading(true)
    setError(null)
    const response = await fetch("/api/pages/visibility/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, visibility: nextVisibility }),
    })
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; visibility?: "public" | "private"; error?: string }
      | null
    if (!response.ok || !payload?.ok || !payload.visibility) {
      setError(payload?.error ?? t("visibilityUpdateError"))
      setLoading(false)
      return
    }
    setVisibility(payload.visibility)
    setStatus(
      payload.visibility === "private" ? t("madePrivate") : t("madePublic")
    )
    setLoading(false)
  }

  const removeMember = async (userId: string) => {
    setLoading(true)
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
      setLoading(false)
      return
    }
    setStatus(t("memberRemoved"))
    setLoading(false)
    void loadLists()
  }

  const sortedInvitations = useMemo(
    () =>
      [...invitations].sort((a, b) =>
        b.expires_at.localeCompare(a.expires_at)
      ),
    [invitations]
  )

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-foreground">{t("title")}</p>
        <div className="inline-flex items-center gap-2">
          <Button
            size="sm"
            variant={isPrivate ? "default" : "outline"}
            disabled={loading}
            onClick={() => updateVisibility("private")}
          >
            {t("visibilityPrivate")}
          </Button>
          <Button
            size="sm"
            variant={!isPrivate ? "default" : "outline"}
            disabled={loading}
            onClick={() => updateVisibility("public")}
          >
            {t("visibilityPublic")}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {isPrivate ? t("privateHint") : t("publicHint")}
      </p>
      {isPrivate && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={loading} onClick={generateInvite}>
              {t("generateInvite")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!inviteUrl || loading}
              onClick={copyInvite}
            >
              {t("copyInvite")}
            </Button>
          </div>
          {inviteUrl && (
            <p className="break-all rounded-md border border-border bg-background px-2 py-1 text-xs">
              {inviteUrl.replace("/fr/", `/${locale}/`)}
            </p>
          )}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("activeInvites")}
            </p>
            {sortedInvitations.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("noInvites")}</p>
            ) : (
              sortedInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-background p-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs text-foreground">
                      {t("inviteUsage", {
                        used: invitation.used_count,
                        max: invitation.max_uses ?? "∞",
                      })}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {t("inviteExpires", { date: new Date(invitation.expires_at).toLocaleString(locale) })}
                    </p>
                  </div>
                  {!invitation.revoked_at && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={loading}
                      onClick={() => revokeInvite(invitation.id)}
                    >
                      {tCommon("remove")}
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("members")}
            </p>
            {members.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("noMembers")}</p>
            ) : (
              members.map((member) => {
                const user = Array.isArray(member.users)
                  ? member.users[0] ?? null
                  : member.users ?? null
                const label = user?.username || user?.email || member.user_id
                return (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-background p-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs text-foreground">{label}</p>
                      <p className="text-[11px] capitalize text-muted-foreground">
                        {member.role}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={loading}
                      onClick={() => removeMember(member.user_id)}
                    >
                      {tCommon("remove")}
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {status && (
        <Alert variant="success" title={status} />
      )}
    </div>
  )
}

