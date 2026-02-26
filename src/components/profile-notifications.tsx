"use client"

import { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Bell, BellOff, FileText, Globe, Lightbulb } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"

type PageSubscription = {
  page_id: string
  page: { id: string; name: string | null; slug: string | null }
}

type PropositionSubscription = {
  proposition_id: string
  proposition: { id: string; title: string | null }
}

type Props = {
  pageSubscriptions: PageSubscription[]
  propositionSubscriptions: PropositionSubscription[]
}

export function ProfileNotifications({
  pageSubscriptions,
  propositionSubscriptions,
}: Props) {
  const t = useTranslations("ProfileNotifications")
  const tCommon = useTranslations("Common")
  const { showToast } = useToast()
  const [togglingPageId, setTogglingPageId] = useState<string | null>(null)
  const [togglingPropositionId, setTogglingPropositionId] = useState<string | null>(null)
  const [localPageSubscriptions, setLocalPageSubscriptions] =
    useState<PageSubscription[]>(pageSubscriptions)
  const [localPropositionSubscriptions, setLocalPropositionSubscriptions] =
    useState<PropositionSubscription[]>(propositionSubscriptions)

  const handleUnsubscribePage = async (pageId: string) => {
    setTogglingPageId(pageId)
    const supabase = getSupabaseClient()
    if (!supabase) {
      showToast({
        variant: "error",
        title: t("supabaseNotConfiguredTitle"),
        description: t("supabaseNotConfiguredBodyPage"),
      })
      setTogglingPageId(null)
      return
    }
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (!user) {
      showToast({
        variant: "error",
        title: t("loginRequiredTitle"),
        description: t("loginRequiredBodyPage"),
      })
      setTogglingPageId(null)
      return
    }
    const { error } = await supabase
      .from("page_subscriptions")
      .delete()
      .eq("page_id", pageId)
      .eq("user_id", user.id)
    if (error) {
      showToast({
        variant: "error",
        title: t("removePageErrorTitle"),
        description: error.message,
      })
      setTogglingPageId(null)
      return
    }
    setLocalPageSubscriptions((prev) =>
      prev.filter((item) => item.page_id !== pageId)
    )
    showToast({ variant: "info", title: t("pageUnsubscribed") })
    setTogglingPageId(null)
  }

  const handleUnsubscribeProposition = async (propositionId: string) => {
    setTogglingPropositionId(propositionId)
    const supabase = getSupabaseClient()
    if (!supabase) {
      showToast({
        variant: "error",
        title: t("supabaseNotConfiguredTitle"),
        description: t("supabaseNotConfiguredBodyProposition"),
      })
      setTogglingPropositionId(null)
      return
    }
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (!user) {
      showToast({
        variant: "error",
        title: t("loginRequiredTitle"),
        description: t("loginRequiredBodyProposition"),
      })
      setTogglingPropositionId(null)
      return
    }
    const { error } = await supabase
      .from("proposition_subscriptions")
      .delete()
      .eq("proposition_id", propositionId)
      .eq("user_id", user.id)
    if (error) {
      showToast({
        variant: "error",
        title: t("removePropositionErrorTitle"),
        description: error.message,
      })
      setTogglingPropositionId(null)
      return
    }
    setLocalPropositionSubscriptions((prev) =>
      prev.filter((item) => item.proposition_id !== propositionId)
    )
    showToast({ variant: "info", title: t("propositionUnsubscribed") })
    setTogglingPropositionId(null)
  }

  const totalCount =
    localPageSubscriptions.length + localPropositionSubscriptions.length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{t("title")}</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("subtitle")}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {totalCount === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Bell className="size-6 text-muted-foreground" />
            </span>
            <p className="text-sm text-muted-foreground">
              {t("emptyState")}
            </p>
          </div>
        ) : (
          <>
            {localPageSubscriptions.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 px-1">
                  <Globe className="size-3.5 text-muted-foreground" />
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {tCommon("page")}
                  </h3>
                </div>
                <div className="divide-y divide-border rounded-lg border border-border">
                  {localPageSubscriptions.map(({ page_id, page }) => (
                    <div
                      key={page_id}
                      className="flex items-center gap-3 px-3 py-2.5"
                    >
                      <Bell className="size-3.5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        {page.slug ? (
                          <Link
                            href={`/pages/${page.slug}`}
                            className="truncate text-sm font-medium text-foreground hover:text-primary"
                          >
                            {page.name ?? tCommon("page")}
                          </Link>
                        ) : (
                          <span className="truncate text-sm font-medium text-foreground">
                            {page.name ?? tCommon("page")}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={togglingPageId === page_id}
                        onClick={() => handleUnsubscribePage(page_id)}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
                        aria-label={t("unsubscribeAria")}
                        title={t("unsubscribeAria")}
                      >
                        <BellOff className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {localPropositionSubscriptions.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 px-1">
                  <Lightbulb className="size-3.5 text-muted-foreground" />
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {tCommon("propositionPlural")}
                  </h3>
                </div>
                <div className="divide-y divide-border rounded-lg border border-border">
                  {localPropositionSubscriptions.map(
                    ({ proposition_id, proposition }) => (
                      <div
                        key={proposition_id}
                        className="flex items-center gap-3 px-3 py-2.5"
                      >
                        <Bell className="size-3.5 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/propositions/${proposition.id}`}
                            className="truncate text-sm font-medium text-foreground hover:text-primary"
                          >
                            {proposition.title ?? tCommon("proposition")}
                          </Link>
                        </div>
                        <button
                          type="button"
                          disabled={togglingPropositionId === proposition_id}
                          onClick={() => handleUnsubscribeProposition(proposition_id)}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
                          aria-label={t("unsubscribeAria")}
                          title={t("unsubscribeAria")}
                        >
                          <BellOff className="size-3.5" />
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
