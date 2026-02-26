import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageChildPagesList } from "@/components/page-child-pages-list"
import { PageOwnerMenu } from "@/components/page-owner-menu"
import { PageSubscribeButton } from "@/components/page-subscribe-button"
import { PagePropositionSearch } from "@/components/page-proposition-search"
import { PagePropositionsTable } from "@/components/page-propositions-table"
import { PageDescriptionTranslatable } from "@/components/page-description-translatable"
import { prefetchTranslations } from "@/lib/translations/prefetch"
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
    .select("name, description, visibility")
    .eq("slug", slug)
    .maybeSingle()
  if (!page) return {}
  const description =
    page.description?.replace(/<[^>]*>/g, "").trim() ||
    "Plateforme de feedback collaboratif."
  return {
    title: page.name ?? "FOROM",
    description,
    robots:
      page.visibility === "private"
        ? { index: false, follow: false }
        : undefined,
    openGraph: {
      title: page.name ?? "FOROM",
      description,
      url: `/${locale}/pages/${slug}`,
    },
  }
}

export default async function PageDashboard({ params, searchParams }: Props) {
  const { slug, locale } = await params
  setRequestLocale(locale)
  const tCommon = await getTranslations("Common")
  const tPage = await getTranslations("PageDashboard")
  const tCategories = await getTranslations("Categories")
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
      "id, name, description, category, is_verified, reactivity_score, website_url, certification_type, owner_id, owner_notify_daily, owner_vote_threshold, parent_page_id, visibility"
    )
    .eq("slug", slug)
    .single()

  if (pageError || !page) {
    notFound()
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  const userId = authUser?.id ?? null
  const isOwner = userId === page.owner_id
  const { data: membership } = userId
    ? await supabase
        .from("page_members")
        .select("user_id")
        .eq("page_id", page.id)
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null }
  if (page.visibility === "private" && !isOwner && !membership) {
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
      "id, title, description, status, votes_count, created_at, comments(count), users!author_id(username, email, avatar_url)"
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

  const propositionIds = sortedPropositions.map((item) => item.id).filter(Boolean)

  const [initialVotedIds, initialTranslations] = await Promise.all([
    sortedPropositions.length > 0
      ? (async () => {
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
      : Promise.resolve([]),
    prefetchTranslations(supabase, propositionIds, "propositions", ["title"], locale),
  ])

  const CATEGORY_KEYS = [
    "country", "region", "city", "district", "supranational",
    "company", "brand", "institution", "association", "school",
    "product", "service", "app", "website", "platform",
    "place", "venue", "event", "media", "community", "other",
  ] as const

  // Build translated label map for the current locale
  const categoryLabels: Record<string, string> = Object.fromEntries(
    CATEGORY_KEYS.map((key) => [key, tCategories(key)])
  )

  // Reverse map: current locale label → translated label
  const reverseMap: Record<string, string> = Object.fromEntries(
    CATEGORY_KEYS.map((key) => [tCategories(key).toLowerCase(), tCategories(key)])
  )

  // Legacy aliases: old French labels that were renamed in messages files
  const legacyAliases: Record<string, string> = {
    "site internet": tCategories("website"),
    "pays": tCategories("country"),
    "entreprise": tCategories("company"),
    "marque": tCategories("brand"),
    "application": tCategories("app"),
    "site web": tCategories("website"),
    "plateforme": tCategories("platform"),
    "lieu": tCategories("place"),
    "événement": tCategories("event"),
    "media": tCategories("media"),
    "communauté": tCategories("community"),
    "autre": tCategories("other"),
  }

  const resolveCategoryLabel = (raw: string | null): string | null => {
    if (!raw) return null
    if (categoryLabels[raw]) return categoryLabels[raw]
    const lower = raw.toLowerCase()
    return reverseMap[lower] ?? legacyAliases[lower] ?? raw
  }

  const categoryLabel = resolveCategoryLabel(page.category ?? null)

  const userData = { user: authUser }
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
                  {!page.is_verified && isOwner && (
                    <PageOwnerMenu
                      pageId={page.id}
                      ownerId={page.owner_id}
                      initialDaily={page.owner_notify_daily ?? false}
                      initialThreshold={page.owner_vote_threshold ?? null}
                      isVerified={page.is_verified}
                      trigger="verificationBadge"
                    />
                  )}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {page.visibility === "private" && (
                    <Badge variant="outline">{tPage("privateBadge")}</Badge>
                  )}
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
                  <PageDescriptionTranslatable
                    pageId={page.id}
                    originalDescription={page.description}
                  />
                )}
                <PageChildPagesList
                  childPages={childPages ?? []}
                  parentPageId={page.id}
                  isOwner={!!isOwner}
                  locale={locale}
                  title={tPage("childPagesTitle")}
                />
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
                    initialVisibility={page.visibility === "private" ? "private" : "public"}
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
                initialTranslations={initialTranslations}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}