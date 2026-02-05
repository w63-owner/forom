"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast"
import { getSupabaseClient } from "@/utils/supabase/client"

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
        title: "Supabase non configuré",
        description: "Impossible de retirer la page pour le moment.",
      })
      setRemovingPageId(null)
      return
    }
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      showToast({
        variant: "error",
        title: "Connexion requise",
        description: "Connectez-vous pour retirer cette page.",
      })
      setRemovingPageId(null)
      return
    }
    const { error } = await supabase
      .from("page_subscriptions")
      .delete()
      .eq("page_id", pageId)
      .eq("user_id", userData.user.id)
    if (error) {
      showToast({
        variant: "error",
        title: "Impossible de retirer la page",
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
        title: "Supabase non configuré",
        description: "Impossible de retirer la proposition pour le moment.",
      })
      setRemovingPropositionId(null)
      return
    }
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      showToast({
        variant: "error",
        title: "Connexion requise",
        description: "Connectez-vous pour retirer cette proposition.",
      })
      setRemovingPropositionId(null)
      return
    }
    const { error } = await supabase
      .from("proposition_subscriptions")
      .delete()
      .eq("proposition_id", propositionId)
      .eq("user_id", userData.user.id)
    if (error) {
      showToast({
        variant: "error",
        title: "Impossible de retirer la proposition",
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
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Vous n&apos;êtes abonné à aucune page ni aucune proposition. Vous serez
            notifié ici des pages et propositions pour lesquelles vous avez
            activé les notifications.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pages et propositions pour lesquelles vous recevez des e-mails. Cliquez
          sur « Retirer » pour ne plus être notifié.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {localPageSubscriptions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Pages</h3>
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
                      {page.name ?? "Page"}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">
                      {page.name ?? "Page"}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnsubscribePage(page_id)}
                    disabled={removingPageId === page_id}
                  >
                    {removingPageId === page_id ? "..." : "Retirer"}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {localPropositionSubscriptions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Propositions</h3>
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
                      {proposition.title ?? "Proposition"}
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
                        : "Retirer"}
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
