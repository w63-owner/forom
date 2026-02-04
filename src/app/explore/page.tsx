import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ExploreTopTable } from "@/components/explore-top-table"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import ExploreFilters from "./filters"

type Props = {
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

export default async function ExplorePage({ searchParams }: Props) {
  const params = (await searchParams) ?? {}
  const query = params.q?.trim() ?? ""
  const sort = params.sort === "recent" ? "recent" : "votes"
  const statusParam = params.status?.trim()
  const statusValues =
    statusParam && statusParam !== "all" ? [statusParam] : []
  const range = params.range ?? "all"
  const order = params.order === "asc" ? "asc" : "desc"
  const titleSort = params.titleSort === "title" ? "title" : "none"
  const titleOrder = params.titleOrder === "desc" ? "desc" : "asc"
  const pageSort =
    params.pageSort === "name" || params.pageSort === "status"
      ? params.pageSort
      : "none"
  const pageOrder = params.pageOrder === "desc" ? "desc" : "asc"
  const statusOrder = params.statusOrder === "desc" ? "desc" : "asc"
  const rangeStart = getRangeStart(range)

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
      const statusA = a.status ?? "Open"
      const statusB = b.status ?? "Open"
      const compare = statusA.localeCompare(statusB)
      return statusOrder === "asc" ? compare : -compare
    }
    return 0
  })

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <header className="space-y-2">
          <Link
            href="/"
            className="link-nav inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Retour
          </Link>
          <h1 className="text-3xl font-semibold text-foreground">
            Explorer les propositions
          </h1>
          <p className="text-muted-foreground">
            Découvrez les idées les plus populaires et les propositions
            orphelines.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">
            Top propositions
          </h2>
          <Card>
            <CardContent className="space-y-4">
              <ExploreFilters
                initialQuery={query}
                initialStatusValue={statusParam ?? "all"}
                initialSort={sort}
                initialRange={range}
                initialOrder={order}
                initialPageSort={pageSort}
                initialPageOrder={pageOrder}
                initialStatusOrder={statusOrder}
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
