"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProfileNotifications } from "@/components/profile-notifications"

type Profile = {
  username: string | null
  email: string | null
  avatar_url: string | null
} | null

type Proposition = {
  id: string
  title: string | null
  status: string | null
  created_at: string | null
}

type OwnedPage = {
  id: string
  name: string | null
  slug: string | null
}

type PageSubscription = {
  page_id: string
  page: { id: string; name: string | null; slug: string | null }
}

type PropositionSubscription = {
  proposition_id: string
  proposition: { id: string; title: string | null }
}

type ViewKey = "profil" | "notifications" | "mes-propositions" | "mes-pages"

type ProfileShellProps = {
  profile: Profile
  userEmailFallback: string
  doneCount: number | null
  propositions: Proposition[]
  ownedPages: OwnedPage[]
  pageSubscriptions: PageSubscription[]
  propositionSubscriptions: PropositionSubscription[]
}

export function ProfileShell({
  profile,
  userEmailFallback,
  doneCount,
  propositions,
  ownedPages,
  pageSubscriptions,
  propositionSubscriptions,
}: ProfileShellProps) {
  const searchParams = useSearchParams()
  const urlView = (searchParams.get("view") as ViewKey | null) ?? "profil"
  const [view, setView] = useState<ViewKey>(urlView)

  // Synchronise l'onglet affiché avec le paramètre d'URL (?view=...)
  useEffect(() => {
    setView(urlView)
  }, [urlView])

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      {/* Panneau de navigation à gauche */}
      <aside className="w-full shrink-0 rounded-xl border bg-card px-4 py-4 text-sm md:w-60">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Mon espace
        </p>
        <nav className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setView("profil")}
            className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
          >
            Mon profil
          </button>
          <button
            type="button"
            onClick={() => setView("notifications")}
            className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
          >
            Paramètres de notifications
          </button>
          <button
            type="button"
            onClick={() => setView("mes-propositions")}
            className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
          >
            Mes propositions
          </button>
          <button
            type="button"
            onClick={() => setView("mes-pages")}
            className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
          >
            Mes pages
          </button>
        </nav>
      </aside>

      {/* Contenu principal à droite : un seul panneau à la fois */}
      <div className="flex-1 space-y-6">
        {view === "profil" && (
          <section id="profil">
            <Card>
              <CardHeader>
                <CardTitle>Profil</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={profile?.avatar_url ?? null}
                    name={profile?.username ?? profile?.email ?? userEmailFallback}
                    size="lg"
                  />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {profile?.username ?? "Utilisateur"} ·{" "}
                      {profile?.email ?? userEmailFallback}
                    </p>
                    <Badge variant="secondary" className="mt-1">
                      Niveau {doneCount ?? 0}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {view === "notifications" && (
          <section id="notifications">
            <ProfileNotifications
              pageSubscriptions={pageSubscriptions}
              propositionSubscriptions={propositionSubscriptions}
            />
          </section>
        )}

        {view === "mes-propositions" && (
          <section id="mes-propositions">
            <Card>
              <CardHeader>
                <CardTitle>Mes propositions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {propositions.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <Link
                      href={`/propositions/${item.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {item.title}
                    </Link>
                    <Badge variant="outline">{item.status ?? "Open"}</Badge>
                  </div>
                ))}
                {propositions.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Vous n&apos;avez pas encore de propositions.
                    </p>
                    <Link
                      href="/propositions/create"
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      + Créer une proposition
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {view === "mes-pages" && (
          <section id="mes-pages">
            <Card>
              <CardHeader>
                <CardTitle>Pages possédées</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ownedPages.map((page) => (
                  <Link
                    key={page.id}
                    href={`/pages/${page.slug}`}
                    className="block text-sm font-medium text-foreground hover:underline"
                  >
                    {page.name}
                  </Link>
                ))}
                {ownedPages.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Vous ne possédez aucune page.
                    </p>
                    <Link
                      href="/pages/create"
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      + Créer une page
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </div>
  )
}

