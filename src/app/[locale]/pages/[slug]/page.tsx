import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageChildPagesList } from "@/components/page-child-pages-list"
import { PageOwnerMenu } from "@/components/page-owner-menu"
import { PageSubscribeButton } from "@/components/page-subscribe-button"
import { PagePropositionSearch } from "@/components/page-proposition-search"
import { PagePropositionsTable } from "@/components/page-propositions-table"
import { compareStatuses } from "@/lib/status-labels"
import { getSupabaseServerClient } from "@/utils/supabase/server"

type Props = {
  params: Promise<{ slug: string; locale: string }>
  searchParams?: Promise<{
    sort?: string
    status?: string
    q?: string
    statusSort?: string
    statusOrder?: string
    tab?: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params
  const supabase = await getSupabaseServerClient()
  if (!supabase) return {}
  const { data: page } = await supabase
    .from("pages")
    .select("name, description")
    .eq("slug", slug)
    .maybeSingle()
  if (!page) return {}
  const description =
    page.description?.replace(/<[^>]*>/g, "").trim() ||
    "Plateforme de feedback collaboratif."
  return {
    title: page.name ?? "FOROM",
    description,
    openGraph: {
      title: page.name ?? "FOROM",
      description,
      url: `/${locale}/pages/${slug}`,
    },
  }
}

export default async function PageDashboard({ params, searchParams }: Props) {
  const tCommon = await getTranslations("Common")
  const tPage = await getTranslations("PageDashboard")
  const tCategories = await getTranslations("Categories")
  const { slug, locale } = await params
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
              <CardTitle>{tPage("supabaseNotConfiguredTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              {tPage("supabaseNotConfiguredBody")}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { data: page, error: pageError } = await supabase
    .from("pages")
    .select(
      "id, name, description, category, is_verified, reactivity_score, website_url, certification_type, owner_id, owner_notify_daily, owner_vote_threshold, parent_page_id"
    )
    .eq("slug", slug)
    .single()

  if (pageError || !page) {
    notFound()
  }

  const parentPage =
    page.parent_page_id
      ? (
          await supabase
            .from("pages")
            .select("id, name, slug")
            .eq("id", page.parent_page_id)
            .maybeSingle()
        ).data
      : null

  const { data: childPages } = await supabase
    .from("pages")
    .select("id, name, slug")
    .eq("parent_page_id", page.id)
    .order("name", { ascending: true })
    .limit(30)

  const propositionQuery = supabase
    .from("propositions")
    .select(
      "id, title, description, status, votes_count, created_at, users!author_id(username, email, avatar_url)"
    )
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
      return compareStatuses(a.status, b.status, statusOrder)
    }
    return 0
  })

  const initialVotedIds =
    sortedPropositions.length > 0
      ? await (async () => {
          const propositionIds = sortedPropositions.map((item) => item.id).filter(Boolean)
          if (propositionIds.length === 0) return []
          const { data: authData } = await supabase.auth.getUser()
          const userId = authData.user?.id
          if (!userId) return []
          const { data: voteRows } = await supabase
            .from("votes")
            .select("proposition_id, type")
            .eq("user_id", userId)
            .in("proposition_id", propositionIds)
          return (voteRows ?? [])
            .filter((row) => row.type === "Upvote")
            .map((row) => row.proposition_id)
        })()
      : []

  const categoryLabels: Record<string, string> = {
    country: tCategories("country"),
    region: tCategories("region"),
    city: tCategories("city"),
    district: tCategories("district"),
    supranational: tCategories("supranational"),
    company: tCategories("company"),
    brand: tCategories("brand"),
    institution: tCategories("institution"),
    association: tCategories("association"),
    school: tCategories("school"),
    product: tCategories("product"),
    service: tCategories("service"),
    app: tCategories("app"),
    website: tCategories("website"),
    platform: tCategories("platform"),
    place: tCategories("place"),
    venue: tCategories("venue"),
    event: tCategories("event"),
    media: tCategories("media"),
    community: tCategories("community"),
    other: tCategories("other"),
  }
  const categoryLabel = page.category
    ? categoryLabels[page.category] ?? page.category
    : null

  const { data: userData } = await supabase.auth.getUser()
  const isOwner = userData.user?.id === page.owner_id
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.startsWith("http")
      ? process.env.NEXT_PUBLIC_APP_URL
      : "https://www.forom.app"
  const embedUrl = `${appUrl}/${locale}/embed/pages/${slug}/propositions?theme=light&limit=10&sort=top&bg=%23ffffff&header=%23ffffff&avatars=1`

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Link
          href="/"
          className="link-nav inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          ← {tCommon("back")}
        </Link>
        <Card>
          <CardHeader className="flex flex-col gap-2">
            <div className="flex w-full items-start justify-between gap-4">
              <div className="space-y-2">
                {parentPage && (
                  <nav
                    aria-label={tPage("breadcrumbLabel")}
                    className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <Link
                      href={`/${locale}/pages/${parentPage.slug}`}
                      className="hover:text-foreground hover:underline"
                    >
                      {parentPage.name}
                    </Link>
                    <span aria-hidden="true">/</span>
                    <span className="font-medium text-foreground">
                      {page.name}
                    </span>
                  </nav>
                )}
                <CardTitle className="flex items-center gap-2 text-3xl">
                  {page.name}
                  {page.is_verified && (
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[11px] font-semibold text-white"
                      aria-label={tPage("verifiedPage")}
                      title={tPage("verifiedPage")}
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
                        {tCommon("website")}
                      </a>
                    </Badge>
                  )}
                </div>
                {page.description && (
                  <p className="text-sm text-[#333D42]">
                    {page.description}
                  </p>
                )}
                {childPages && childPages.length > 0 && (
                  <PageChildPagesList
                    childPages={childPages}
                    parentPageId={page.id}
                    isOwner={!!isOwner}
                    locale={locale}
                    title={tPage("childPagesTitle")}
                  />
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
                <span>{tPage("reactivityScore")}</span>
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
                    embedBaseUrl={isOwner ? embedUrl : null}
                    backgroundColor="#ffffff"
                    headerColor="#ffffff"
                    showAvatars
                  />
                </div>
              </div>
              <PagePropositionsTable
                pageId={page.id}
                pageName={page.name}
                initialItems={sortedPropositions as {
                  id: string
                  title: string | null
                  status: string | null
                  votes_count: number | null
                  users?:
                    | { username: string | null; email: string | null; avatar_url?: string | null }
                    | {
                        username: string | null
                        email: string | null
                        avatar_url?: string | null
                      }[]
                    | null
                }[]}
                initialVotedIds={initialVotedIds}
                query={query}
                status={status}
                sort={sort}
                statusSort={statusSort}
                statusOrder={statusOrder}
                pageOwnerId={page.owner_id ?? null}
                currentUserId={userData.user?.id ?? null}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}