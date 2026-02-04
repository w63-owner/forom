import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageSubscribeButton } from "@/components/page-subscribe-button"
import { PageOwnerMenu } from "@/components/page-owner-menu"
import { PageVoteToggle } from "@/components/page-vote-toggle"
import { PagePropositionSearch } from "@/components/page-proposition-search"
import { PagePropositionsTable } from "@/components/page-propositions-table"
import { getSupabaseServerClient } from "@/utils/supabase/server"

type Props = {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{
    sort?: string
    status?: string
    q?: string
    statusSort?: string
    statusOrder?: string
    tab?: string
  }>
}

export default async function PageDashboard({ params, searchParams }: Props) {
  const { slug } = await params
  const queryParams = (await searchParams) ?? {}
  const sort = queryParams.sort === "recent" ? "recent" : "top"
  const status = queryParams.status && queryParams.status !== "all" ? queryParams.status : null
  const query = queryParams.q?.trim() ?? ""
  const statusSort = queryParams.statusSort === "status" ? "status" : "none"
  const statusOrder = queryParams.statusOrder === "desc" ? "desc" : "asc"
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
      "id, name, description, category, is_verified, reactivity_score, website_url, certification_type, owner_id, owner_notify_daily, owner_vote_threshold"
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

  const { data: propositions } = await propositionQuery.limit(20)
  const sortedPropositions = [...(propositions ?? [])].sort((a, b) => {
    if (statusSort === "status") {
      const statusA = a.status ?? "Open"
      const statusB = b.status ?? "Open"
      const compare = statusA.localeCompare(statusB)
      return statusOrder === "asc" ? compare : -compare
    }
    return 0
  })

  const categoryLabels: Record<string, string> = {
    country: "Pays",
    region: "Région / État",
    city: "Ville",
    district: "Arrondissement / Quartier",
    supranational: "Supranational",
    company: "Entreprise",
    brand: "Marque",
    institution: "Institution",
    association: "Association",
    school: "Établissement",
    product: "Produit",
    service: "Service",
    app: "Application",
    website: "Site web",
    platform: "Plateforme",
    place: "Lieu",
    venue: "Établissement (magasin, restaurant…)",
    event: "Événement",
    media: "Média",
    community: "Communauté",
    other: "Autre",
  }
  const categoryLabel = page.category
    ? categoryLabels[page.category] ?? page.category
    : null

  const { data: userData } = await supabase.auth.getUser()
  const isOwner = userData.user?.id === page.owner_id

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Link
          href="/"
          className="link-nav inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Retour
        </Link>
        <Card>
          <CardHeader className="flex flex-col gap-2">
            <div className="flex w-full items-start justify-between gap-4">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-3xl">
                  {page.name}
                  {page.is_verified && (
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[11px] font-semibold text-white"
                      aria-label="Page vérifiée"
                      title="Page vérifiée"
                    >
                      ✓
                    </span>
                  )}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {categoryLabel && (
                    <Badge className="w-fit" variant="secondary">
                      {categoryLabel}
                    </Badge>
                  )}
                  {page.website_url && (
                    <Badge variant="outline" asChild>
                      <a href={page.website_url} target="_blank" rel="noreferrer">
                        Site web
                      </a>
                    </Badge>
                  )}
                </div>
                {page.description && (
                  <p className="text-sm text-muted-foreground">
                    {page.description}
                  </p>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2 pt-1">
                <PageSubscribeButton pageId={page.id} />
                {isOwner && (
                  <PageOwnerMenu
                    pageId={page.id}
                    ownerId={page.owner_id}
                    initialDaily={page.owner_notify_daily ?? false}
                    initialThreshold={page.owner_vote_threshold ?? null}
                    isVerified={page.is_verified}
                  />
                )}
              </div>
            </div>
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

        <div className="space-y-2">
          <Card>
            <CardContent className="p-0">
              <div className="px-4 pb-3">
                <div className="flex w-full flex-wrap gap-2">
                  <PagePropositionSearch
                    slug={slug}
                    initialQuery={query}
                    status={status}
                    sort={sort}
                    statusSort={statusSort === "none" ? null : statusSort}
                    statusOrder={statusOrder ?? null}
                    tab="propositions"
                  />
                </div>
              </div>
              <PagePropositionsTable
                pageId={page.id}
                initialItems={sortedPropositions as { id: string; title: string | null; status: string | null; votes_count: number | null }[]}
                query={query}
                status={status}
                sort={sort}
                statusSort={statusSort}
                statusOrder={statusOrder}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
