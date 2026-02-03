"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSupabaseClient } from "@/utils/supabase/client"

type PageSubscription = {
  page_id: string
  page: { id: string; name: string; slug: string }
}

type PropositionSubscription = {
  proposition_id: string
  proposition: { id: string; title: string }
}

type Props = {
  pageSubscriptions: PageSubscription[]
  propositionSubscriptions: PropositionSubscription[]
}

export function ProfileNotifications({
  pageSubscriptions,
  propositionSubscriptions,
}: Props) {
  const router = useRouter()
  const [removingPageId, setRemovingPageId] = useState<string | null>(null)
  const [removingPropositionId, setRemovingPropositionId] = useState<
    string | null
  >(null)

  const handleUnsubscribePage = async (pageId: string) => {
    setRemovingPageId(pageId)
    const supabase = getSupabaseClient()
    if (!supabase) {
      setRemovingPageId(null)
      return
    }
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setRemovingPageId(null)
      return
    }
    await supabase
      .from("page_subscriptions")
      .delete()
      .eq("page_id", pageId)
      .eq("user_id", userData.user.id)
    setRemovingPageId(null)
    router.refresh()
  }

  const handleUnsubscribeProposition = async (propositionId: string) => {
    setRemovingPropositionId(propositionId)
    const supabase = getSupabaseClient()
    if (!supabase) {
      setRemovingPropositionId(null)
      return
    }
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setRemovingPropositionId(null)
      return
    }
    await supabase
      .from("proposition_subscriptions")
      .delete()
      .eq("proposition_id", propositionId)
      .eq("user_id", userData.user.id)
    setRemovingPropositionId(null)
    router.refresh()
  }

  const totalCount =
    pageSubscriptions.length + propositionSubscriptions.length

  if (totalCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Vous n'êtes abonné à aucune page ni aucune proposition. Vous serez
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
        {pageSubscriptions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Pages</h3>
            <ul className="space-y-2">
              {pageSubscriptions.map(({ page_id, page }) => (
                <li
                  key={page_id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <Link
                    href={`/pages/${page.slug}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {page.name}
                  </Link>
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

        {propositionSubscriptions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Propositions</h3>
            <ul className="space-y-2">
              {propositionSubscriptions.map(
                ({ proposition_id, proposition }) => (
                  <li
                    key={proposition_id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <Link
                      href={`/propositions/${proposition.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {proposition.title}
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
