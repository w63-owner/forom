import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageOwnerNotifications } from "@/components/page-owner-notifications"
import { getSupabaseServerClient } from "@/utils/supabase/server"

type Props = {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ sort?: string; status?: string; q?: string }>
}

export default async function PageDashboard({ params, searchParams }: Props) {
  const { slug } = await params
  const queryParams = (await searchParams) ?? {}
  const sort = queryParams.sort === "recent" ? "recent" : "top"
  const status = queryParams.status && queryParams.status !== "all" ? queryParams.status : null
  const query = queryParams.q?.trim() ?? ""
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return (
      <div className="min-h-screen bg-muted/40 px-6 py-16">
        <div className="mx-auto w-full max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Supabase non configuré</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Configurez les variables d'environnement Supabase.
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { data: page, error: pageError } = await supabase
    .from("pages")
    .select(
      "id, name, description, is_verified, reactivity_score, website_url, certification_type, owner_id, owner_notify_daily, owner_vote_threshold"
    )
    .eq("slug", slug)
    .single()

  if (pageError || !page) {
    notFound()
  }

  const propositionQuery = supabase
    .from("propositions")
    .select("id, title, description, status, votes_count, created_at")
    .eq("page_id", page.id)

  if (status) {
    propositionQuery.eq("status", status)
  }
  if (query) {
    propositionQuery.ilike("title", `%${query}%`)
  }
  if (sort === "recent") {
    propositionQuery.order("created_at", { ascending: false })
  } else {
    propositionQuery.order("votes_count", { ascending: false })
  }

  const { data: propositions } = await propositionQuery
  const { data: donePropositions } = await supabase
    .from("propositions")
    .select("id, title, created_at")
    .eq("page_id", page.id)
    .eq("status", "Done")
    .order("created_at", { ascending: false })
    .limit(5)

  const { data: userData } = await supabase.auth.getUser()
  const isOwner = userData.user?.id === page.owner_id

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="w-fit" variant="secondary">
                {page.is_verified ? "Produit vérifié" : "Produit public"}
              </Badge>
              {page.website_url && (
                <Badge variant="outline" asChild>
                  <a href={page.website_url} target="_blank" rel="noreferrer">
                    Site web
                  </a>
                </Badge>
              )}
            </div>
            <CardTitle className="text-3xl">{page.name}</CardTitle>
            {page.description && (
              <p className="text-sm text-muted-foreground">{page.description}</p>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-muted-foreground">
            {page.reactivity_score !== null && (
              <div className="flex items-center justify-between">
                <span>Score de réactivité</span>
                <span className="text-lg font-semibold text-foreground">
                  {page.reactivity_score}/10
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-end md:justify-between">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Filtrer les propositions
              </label>
              <form className="flex w-full flex-wrap gap-2" method="get">
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="Chercher une proposition..."
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:max-w-sm"
                />
                <select
                  name="status"
                  defaultValue={status ?? "all"}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                  <option value="Won't Do">Won't Do</option>
                </select>
                <select
                  name="sort"
                  defaultValue={sort}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="top">Tri par votes</option>
                  <option value="recent">Tri par date</option>
                </select>
                <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
                  Appliquer
                </button>
              </form>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={sort === "top" ? "default" : "outline"} asChild>
            <Link href={`/pages/${slug}?sort=top${status ? `&status=${encodeURIComponent(status)}` : ""}${query ? `&q=${encodeURIComponent(query)}` : ""}`}>
              Top votes
            </Link>
          </Badge>
          <Badge variant={sort === "recent" ? "default" : "outline"} asChild>
            <Link href={`/pages/${slug}?sort=recent${status ? `&status=${encodeURIComponent(status)}` : ""}${query ? `&q=${encodeURIComponent(query)}` : ""}`}>
              Récents
            </Link>
          </Badge>
          {(page.is_verified || page.certification_type === "OFFICIAL") && (
            <Badge variant="default">Certifiée</Badge>
          )}
        </div>
        {isOwner && (
          <PageOwnerNotifications
            pageId={page.id}
            ownerId={page.owner_id}
            initialDaily={page.owner_notify_daily ?? false}
            initialThreshold={page.owner_vote_threshold ?? null}
          />
        )}

        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Nouveautés</h2>
          <div className="grid gap-3">
            {(donePropositions ?? []).map((item) => (
              <Card key={item.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <Link
                      href={`/propositions/${item.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {item.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Terminé le{" "}
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString("fr-FR")
                        : "—"}
                    </p>
                  </div>
                  <Badge variant="secondary">Done</Badge>
                </CardContent>
              </Card>
            ))}
            {donePropositions?.length === 0 && (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">
                  Aucun changement terminé pour le moment.
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            Propositions
          </h2>
          <div className="grid gap-3">
            {(propositions ?? []).map((item) => (
              <Card key={item.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <Link
                      href={`/propositions/${item.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {item.title}
                    </Link>
                      {item.description?.replace(/<[^>]*>/g, "").trim() && (
                        <p className="text-xs text-muted-foreground">
                          {item.description.replace(/<[^>]*>/g, "").trim()}
                        </p>
                      )}
                    <p className="text-xs text-muted-foreground">
                      {item.votes_count ?? 0} votes
                    </p>
                  </div>
                  <Badge variant="outline">{item.status ?? "Open"}</Badge>
                </CardContent>
              </Card>
            ))}
            {propositions?.length === 0 && (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">
                  Aucune proposition pour cette page.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
