import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { DiscoverPropositionsTable } from "@/components/discover-propositions-table"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { SLUG_TO_UNIVERSE } from "@/types/schema"
import DiscoverFilters from "./filters"
import { notFound } from "next/navigation"

type PageMeta = { name?: string | null; slug?: string | null }

const getPageMeta = (pages: PageMeta[] | PageMeta | null | undefined): PageMeta | null => {
  if (!pages) return null
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

type Props = {
  params: Promise<{ locale: string; universe_slug: string }>
  searchParams?: Promise<{
    q?: string
    status?: string
    category?: string
    sub_category?: string
    sort?: string
    range?: string
    order?: string
  }>
}

export default async function DiscoverUniversePage({ params, searchParams }: Props) {
  const { locale, universe_slug } = await params
  setRequestLocale(locale)
  const universe = SLUG_TO_UNIVERSE[universe_slug]
  if (!universe) {
    notFound()
  }

  const [tDiscover, tNav] = await Promise.all([
    getTranslations("Discover"),
    getTranslations("Nav"),
  ])

  const queryParams = (await searchParams) ?? {}
  const query = queryParams.q?.trim() ?? ""
  const statusParam = queryParams.status?.trim()
  const statusValues =
    statusParam && statusParam !== "all" ? [statusParam] : []
  const categoryParam = queryParams.category?.trim()
  const categoryValue =
    categoryParam && categoryParam !== "all" ? categoryParam : null
  const subCategoryParam = queryParams.sub_category?.trim()
  const subCategoryValue =
    subCategoryParam && subCategoryParam !== "all" ? subCategoryParam : null
  const sort = queryParams.sort === "reactivity" ? "reactivity" : "votes"
  const range = queryParams.range ?? "all"
  const order = queryParams.order === "asc" ? "asc" : "desc"
  const rangeStart = getRangeStart(range)

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return (
      <div className="min-h-screen bg-muted/40 px-6 py-16">
        <div className="mx-auto w-full max-w-4xl">
          <Card>
            <CardContent className="pt-6 text-muted-foreground">
              {tDiscover("errorSupabase")}
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

  let propsQuery = supabase
    .from("propositions")
    .select(
      "id, title, status, votes_count, created_at, universe, category, sub_category, pages(name, slug, reactivity_score)"
    )
    .eq("universe", universe)

  if (statusValues.length > 0) {
    propsQuery = propsQuery.in("status", statusValues)
  }
  if (categoryValue) {
    propsQuery = propsQuery.eq("category", categoryValue)
  }
  if (subCategoryValue) {
    propsQuery = propsQuery.eq("sub_category", subCategoryValue)
  }
  if (rangeStart) {
    propsQuery = propsQuery.gte("created_at", rangeStart.toISOString())
  }
  if (query) {
    if (pageIds.length > 0) {
      propsQuery = propsQuery.or(
        `title.ilike.%${query}%,page_id.in.(${pageIds.join(",")})`
      )
    } else {
      propsQuery = propsQuery.ilike("title", `%${query}%`)
    }
  }
  if (sort === "reactivity") {
    propsQuery = propsQuery.order("created_at", { ascending: false })
  } else {
    propsQuery = propsQuery.order("votes_count", { ascending: order === "asc" })
  }

  const { data: propositions } = await propsQuery.limit(20)
  const rawList = propositions ?? []
  const sortedPropositions =
    sort === "reactivity"
      ? [...rawList].sort((a, b) => {
          const pageA = getPageMeta(a.pages) as { reactivity_score?: number | null } | null
          const pageB = getPageMeta(b.pages) as { reactivity_score?: number | null } | null
          const scoreA = pageA?.reactivity_score ?? 0
          const scoreB = pageB?.reactivity_score ?? 0
          return order === "asc" ? scoreA - scoreB : scoreB - scoreA
        })
      : rawList

  const initialVotedIds =
    sortedPropositions.length > 0
      ? await (async () => {
          const ids = sortedPropositions.map((p) => p.id).filter(Boolean)
          if (ids.length === 0) return []
          const { data: authData } = await supabase.auth.getUser()
          const userId = authData.user?.id
          if (!userId) return []
          const { data: voteRows } = await supabase
            .from("votes")
            .select("proposition_id, type")
            .eq("user_id", userId)
            .in("proposition_id", ids)
          return (voteRows ?? [])
            .filter((r) => r.type === "Upvote")
            .map((r) => r.proposition_id)
        })()
      : []

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <header className="space-y-2">
          <Link
            href="/discover"
            className="link-nav inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            ← {tDiscover("backToDiscover")}
          </Link>
          <h1 className="text-3xl font-semibold text-foreground">
            {tDiscover("universePropositions", {
              universe: tDiscover(`universe_${universe}`),
            })}
          </h1>
          <p className="text-muted-foreground">
            {tDiscover("universeDescription")}
          </p>
        </header>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <DiscoverFilters
              universe={universe}
              initialQuery={query}
              initialStatusValue={statusParam ?? "all"}
              initialCategoryValue={categoryParam ?? "all"}
              initialSubCategoryValue={subCategoryParam ?? "all"}
              initialSort={sort}
              initialRange={range}
              initialOrder={order}
            />
            <DiscoverPropositionsTable
              initialItems={sortedPropositions as {
                id: string
                title: string | null
                status: string | null
                votes_count: number | null
                created_at: string | null
                category?: string | null
                sub_category?: string | null
                pages?: PageMeta | PageMeta[] | null
              }[]}
              initialVotedIds={initialVotedIds}
              query={query}
              statusValues={statusValues}
              categoryValue={categoryValue}
              subCategoryValue={subCategoryValue}
              range={range}
              sort={sort}
              order={order}
              universe={universe}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}