"use client"

import { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
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
  const [removingPageId, setRemovingPageId] = useState<string | null>(null)
  const [removingPropositionId, setRemovingPropositionId] = useState<
    string | null
  >(null)
  const [localPageSubscriptions, setLocalPageSubscriptions] =
    useState<PageSubscription[]>(pageSubscriptions)
  const [localPropositionSubscriptions, setLocalPropositionSubscriptions] =
    useState<PropositionSubscription[]>(propositionSubscriptions)

  const handleUnsubscribePage = async (pageId: string) => {
    setRemovingPageId(pageId)
    const supabase = getSupabaseClient()
    if (!supabase) {
      showToast({
        variant: "error",
        title: t("supabaseNotConfiguredTitle"),
        description: t("supabaseNotConfiguredBodyPage"),
      })
      setRemovingPageId(null)
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
      setRemovingPageId(null)
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
      setRemovingPageId(null)
      return
    }
    setLocalPageSubscriptions((prev) =>
      prev.filter((item) => item.page_id !== pageId)
    )
    setRemovingPageId(null)
  }

  const handleUnsubscribeProposition = async (propositionId: string) => {
    setRemovingPropositionId(propositionId)
    const supabase = getSupabaseClient()
    if (!supabase) {
      showToast({
        variant: "error",
        title: t("supabaseNotConfiguredTitle"),
        description: t("supabaseNotConfiguredBodyProposition"),
      })
      setRemovingPropositionId(null)
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
      setRemovingPropositionId(null)
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
      setRemovingPropositionId(null)
      return
    }
    setLocalPropositionSubscriptions((prev) =>
      prev.filter((item) => item.proposition_id !== propositionId)
    )
    setRemovingPropositionId(null)
  }

  const totalCount =
    localPageSubscriptions.length + localPropositionSubscriptions.length

  if (totalCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("emptyState")}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {localPageSubscriptions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">{tCommon("page")}</h3>
            <ul className="space-y-2">
              {localPageSubscriptions.map(({ page_id, page }) => (
                <li
                  key={page_id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  {page.slug ? (
                    <Link
                      href={`/pages/${page.slug}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {page.name ?? tCommon("page")}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">
                      {page.name ?? tCommon("page")}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnsubscribePage(page_id)}
                    disabled={removingPageId === page_id}
                  >
                    {removingPageId === page_id ? "..." : tCommon("remove")}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {localPropositionSubscriptions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">{tCommon("propositionPlural")}</h3>
            <ul className="space-y-2">
              {localPropositionSubscriptions.map(
                ({ proposition_id, proposition }) => (
                  <li
                    key={proposition_id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <Link
                      href={`/propositions/${proposition.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {proposition.title ?? tCommon("proposition")}
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleUnsubscribeProposition(proposition_id)
                      }
                      disabled={removingPropositionId === proposition_id}
                    >
                      {removingPropositionId === proposition_id
                        ? "..."
                        : tCommon("remove")}
                    </Button>
                  </li>
                )
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}