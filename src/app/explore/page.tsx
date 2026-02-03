import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  const statusValues =
    params.status && params.status !== "all"
      ? params.status.split(",").filter((value) => value && value !== "all")
      : []
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

  const { data: topPropositions } = await topQuery.limit(10)
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
                initialStatus={statusValues}
                initialSort={sort}
                initialRange={range}
                initialOrder={order}
                initialPageSort={pageSort}
                initialPageOrder={pageOrder}
                initialStatusOrder={statusOrder}
              />
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">
                      <Link
                        href={`/explore?${new URLSearchParams({
                          ...(query ? { q: query } : {}),
                          ...(statusValues.length > 0
                            ? { status: statusValues.join(",") }
                            : {}),
                          ...(range && range !== "all" ? { range } : {}),
                          sort,
                          ...(order ? { order } : {}),
                          titleSort: "title",
                          titleOrder: titleOrder === "asc" ? "desc" : "asc",
                        }).toString()}`}
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        Proposition
                        <span aria-hidden="true">
                          {titleOrder === "asc" ? "▲" : "▼"}
                        </span>
                      </Link>
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      <Link
                        href={`/explore?${new URLSearchParams({
                          ...(query ? { q: query } : {}),
                          ...(statusValues.length > 0
                            ? { status: statusValues.join(",") }
                            : {}),
                          ...(range && range !== "all" ? { range } : {}),
                          sort,
                          ...(order ? { order } : {}),
                          pageSort: "name",
                          pageOrder: pageOrder === "asc" ? "desc" : "asc",
                          ...(statusOrder ? { statusOrder } : {}),
                        }).toString()}`}
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        Page
                        {pageSort === "name" && (
                          <span aria-hidden="true">
                            {pageOrder === "asc" ? "▲" : "▼"}
                          </span>
                        )}
                      </Link>
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      <Link
                        href={`/explore?${new URLSearchParams({
                          ...(query ? { q: query } : {}),
                          ...(statusValues.length > 0
                            ? { status: statusValues.join(",") }
                            : {}),
                          ...(range && range !== "all" ? { range } : {}),
                          sort,
                          ...(order ? { order } : {}),
                          pageSort: "status",
                          statusOrder: statusOrder === "asc" ? "desc" : "asc",
                          ...(pageOrder ? { pageOrder } : {}),
                        }).toString()}`}
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        Statut
                        <span aria-hidden="true">
                          {statusOrder === "asc" ? "▲" : "▼"}
                        </span>
                      </Link>
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      <Link
                        href={`/explore?${new URLSearchParams({
                          ...(query ? { q: query } : {}),
                          ...(statusValues.length > 0
                            ? { status: statusValues.join(",") }
                            : {}),
                          ...(range && range !== "all" ? { range } : {}),
                          sort: "votes",
                          order: order === "asc" ? "desc" : "asc",
                        }).toString()}`}
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        Votes
                        <span aria-hidden="true">
                          {order === "asc" ? "▲" : "▼"}
                        </span>
                      </Link>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTop.map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <Link
                          href={`/propositions/${item.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {item.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const page = getPageMeta(
                            item.pages as PageMeta[] | PageMeta | null | undefined
                          )
                          return page?.name && page.slug ? (
                          <Badge variant="outline" asChild>
                            <Link href={`/pages/${page.slug}`}>
                              {page.name}
                            </Link>
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{item.status ?? "Open"}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">
                        {item.votes_count ?? 0}
                      </td>
                    </tr>
                  ))}
                  {topPropositions?.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-center text-muted-foreground"
                      >
                        Aucun résultat pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </CardContent>
          </Card>
        </section>

      </div>
    </div>
  )
}
