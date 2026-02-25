"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"
import { useToast } from "@/components/ui/toast"

type Props = {
  pageId: string
  ownerId: string
}

type ParentRequest = {
  id: string
  created_at: string
  child: {
    id: string
    name: string
    slug: string
  } | null
  requester: {
    username: string | null
    email: string | null
  } | null
}

export function PageParentRequests({ pageId, ownerId }: Props) {
  const t = useTranslations("PageParentRequests")
  const tCommon = useTranslations("Common")
  const { showToast } = useToast()
  const [requests, setRequests] = useState<ParentRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadRequests = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError(tCommon("loginRequiredTitle"))
      return
    }
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (!user || user.id !== ownerId) return

    const { data, error: fetchError } = await supabase
      .from("page_parent_requests")
      .select(
        "id, created_at, child:pages!page_parent_requests_child_page_id_fkey(id, name, slug), requester:users!page_parent_requests_requested_by_fkey(username, email)"
      )
      .eq("parent_page_id", pageId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      return
    }
    const normalized: ParentRequest[] = (data ?? []).map((row: any) => ({
      id: row.id,
      created_at: row.created_at,
      child: Array.isArray(row.child) ? row.child[0] ?? null : row.child ?? null,
      requester: Array.isArray(row.requester)
        ? row.requester[0] ?? null
        : row.requester ?? null,
    }))
    setRequests(normalized)
  }

  useEffect(() => {
    void loadRequests()
  }, [pageId, ownerId])

  const handleReview = async (id: string, status: "approved" | "rejected") => {
    if (loading) return
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError(tCommon("loginRequiredTitle"))
      return
    }
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (!user || user.id !== ownerId) {
      setError(tCommon("loginRequiredTitle"))
      return
    }

    setLoading(true)
    setError(null)
    const response = await fetch(`/api/pages/parent-request/${id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null
      setError(payload?.error ?? t("requestError"))
      setLoading(false)
      return
    }
    showToast({
      variant: "success",
      title: status === "approved" ? t("approved") : t("rejected"),
    })
    setLoading(false)
    void loadRequests()
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="font-medium text-foreground">{t("title")}</p>
      {requests.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const requesterName =
              request.requester?.username ||
              request.requester?.email ||
              tCommon("user")
            return (
              <div
                key={request.id}
                className="rounded-md border border-border bg-background p-3"
              >
                <p className="text-sm text-foreground">
                  {request.child?.name ?? tCommon("page")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("requestedBy", { name: requesterName })}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleReview(request.id, "approved")}
                    disabled={loading}
                  >
                    {t("approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReview(request.id, "rejected")}
                    disabled={loading}
                  >
                    {t("reject")}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}