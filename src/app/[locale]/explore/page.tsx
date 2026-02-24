import { getTranslations, setRequestLocale } from "next-intl/server"
import { TopPageHeader } from "@/components/top-page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ExploreTopTable } from "@/components/explore-top-table"
import { compareStatuses } from "@/lib/status-labels"
import { getServerSessionUser, getSupabaseServerClient } from "@/utils/supabase/server"
import ExploreFilters from "./filters"

type Props = {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{
    q?: string
    sort?: string
    status?: string
    range?: string
    order?: string
    pageSort?: string
    pageOrder?: string
    statusOrder?: string
    titleSort?: string
    titleOrder?: string
  }>
}

type PageMeta = { name?: string | null; slug?: string | null }

const getPageMeta = (
  pages: PageMeta[] | PageMeta | null | undefined
): PageMeta | null => {
  if (!pages) {
    return null
  }
  return Array.isArray(pages) ? pages[0] ?? null : pages
}

const getRangeStart = (range: string) => {
  const now = new Date()
  if (range === "week") {
    now.setDate(now.getDate() - 7)
    return now
  }
  if (range === "month") {
    now.setMonth(now.getMonth() - 1)
    return now
  }
  if (range === "year") {
    now.setFullYear(now.getFullYear() - 1)
    return now
  }
  return null
}

export default async function ExplorePage({ params, searchParams }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const [tExplore, tNav, serverUser] = await Promise.all([
    getTranslations("Explore"),
    getTranslations("Nav"),
    getServerSessionUser(),
  ])
  const initialSession = serverUser != null ? { user: serverUser } : null

  const queryParams = (await searchParams) ?? {}
  const query = queryParams.q?.trim() ?? ""
  const sort = queryParams.sort === "recent" ? "recent" : "votes"
  const statusParam = queryParams.status?.trim()
  const statusValues =
    statusParam && statusParam !== "all" ? [statusParam] : []
  const range = queryParams.range ?? "all"
  const order = queryParams.order === "asc" ? "asc" : "desc"
  const titleSort = queryParams.titleSort === "title" ? "title" : "none"
  const titleOrder = queryParams.titleOrder === "desc" ? "desc" : "asc"
  const pageSort =
    queryParams.pageSort === "name" || queryParams.pageSort === "status"
      ? queryParams.pageSort
      : "none"
  const pageOrder = queryParams.pageOrder === "desc" ? "desc" : "asc"
  const statusOrder = queryParams.statusOrder === "desc" ? "desc" : "asc"
  const rangeStart = getRangeStart(range)

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return (
      <div className="min-h-screen bg-muted/40 px-6 py-16">
        <div className="mx-auto w-full max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>{tExplore("errorTitleSupabase")}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              {tExplore("errorBodySupabase")}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const pageIds =
    query.length > 0
      ? (
          await supabase
            .from("pages")
            .select("id")
            .ilike("name", `%${query}%`)
            .limit(25)
        ).data?.map((item) => item.id) ?? []
      : []

  const topQuery = supabase
    .from("propositions")
    .select("id, title, status, votes_count, created_at, pages(name, slug)")

  if (statusValues.length > 0) {
    topQuery.in("status", statusValues)
  }
  if (rangeStart) {
    topQuery.gte("created_at", rangeStart.toISOString())
  }
  if (query) {
    if (pageIds.length > 0) {
      topQuery.or(
        `title.ilike.%${query}%,page_id.in.(${pageIds.join(",")})`
      )
    } else {
      topQuery.ilike("title", `%${query}%`)
    }
  }
  if (sort === "recent") {
    topQuery.order("created_at", { ascending: false })
  } else {
    topQuery.order("votes_count", { ascending: order === "asc" })
  }

  const { data: topPropositions } = await topQuery.limit(20)
  const sortedTop = [...(topPropositions ?? [])].sort((a, b) => {
    if (titleSort === "title") {
      const titleA = a.title ?? ""
      const titleB = b.title ?? ""
      const compare = titleA.localeCompare(titleB)
      return titleOrder === "asc" ? compare : -compare
    }
    if (pageSort === "name") {
      const nameA = getPageMeta(
        a.pages as PageMeta[] | PageMeta | null | undefined
      )?.name ?? ""
      const nameB = getPageMeta(
        b.pages as PageMeta[] | PageMeta | null | undefined
      )?.name ?? ""
      const compare = nameA.localeCompare(nameB)
      return pageOrder === "asc" ? compare : -compare
    }
    if (pageSort === "status") {
      return compareStatuses(a.status, b.status, statusOrder)
    }
    return 0
  })

  const initialVotedIds =
    sortedTop.length > 0
      ? await (async () => {
          const propositionIds = sortedTop.map((item) => item.id).filter(Boolean)
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

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <TopPageHeader
          backHref="/"
          backLabel={`← ${tNav("back")}`}
          initialSession={initialSession}
        />
        <section className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">
            {tExplore("headerTitle")}
          </h1>
          <p className="text-muted-foreground">
            {tExplore("headerDescription")}
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">
            {tExplore("topTitle")}
          </h2>
          <Card>
            <CardContent className="space-y-4">
              <ExploreFilters
                initialQuery={query}
                initialStatusValue={statusParam ?? "all"}
                initialSort={sort}
                initialRange={range}
                initialOrder={order}
              />
              <ExploreTopTable
                initialItems={sortedTop as {
                  id: string
                  title: string | null
                  status: string | null
                  votes_count: number | null
                  created_at: string | null
                  pages?: PageMeta | PageMeta[] | null
                }[]}
                initialVotedIds={initialVotedIds}
                query={query}
                statusValues={statusValues}
                range={range}
                sort={sort}
                order={order}
                titleSort={titleSort}
                titleOrder={titleOrder}
                pageSort={pageSort}
                pageOrder={pageOrder}
                statusOrder={statusOrder}
              />
            </CardContent>
          </Card>
        </section>

      </div>
    </div>
  )
}