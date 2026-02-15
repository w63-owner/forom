import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PagePropositionSearch } from "@/components/page-proposition-search"
import { PagePropositionsTable } from "@/components/page-propositions-table"
import { getSupabaseServerClient } from "@/utils/supabase/server"

type Props = {
  params: Promise<{ locale: string; slug: string }>
  searchParams?: Promise<{
    sort?: string
    status?: string
    q?: string
    statusSort?: string
    statusOrder?: string
    theme?: string
    limit?: string
  }>
}

const normalizeLimit = (value: string | undefined): number => {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed)) return 10
  return Math.min(50, Math.max(5, parsed))
}

export default async function EmbedPagePropositions({ params, searchParams }: Props) {
  const { locale, slug } = await params
  const queryParams = (await searchParams) ?? {}
  const tEmbed = await getTranslations("Embed")

  const sort = queryParams.sort === "recent" ? "recent" : "top"
  const status = queryParams.status && queryParams.status !== "all" ? queryParams.status : null
  const query = queryParams.q?.trim() ?? ""
  const statusSort = queryParams.statusSort === "status" ? "status" : "none"
  const statusOrder = queryParams.statusOrder === "desc" ? "desc" : "asc"
  const theme = queryParams.theme === "dark" ? "dark" : "light"
  const limit = normalizeLimit(queryParams.limit)

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return (
      <div className="min-h-screen bg-muted/40 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>{tEmbed("unavailableTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {tEmbed("unavailableBody")}
          </CardContent>
        </Card>
      </div>
    )
  }

  const { data: page } = await supabase
    .from("pages")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle()

  if (!page) {
    notFound()
  }

  let propositionQuery = supabase
    .from("propositions")
    .select("id, title, description, status, votes_count, created_at")
    .eq("page_id", page.id)

  if (status) {
    propositionQuery = propositionQuery.eq("status", status)
  }
  if (query) {
    propositionQuery = propositionQuery.ilike("title", `%${query}%`)
  }
  if (sort === "recent") {
    propositionQuery = propositionQuery.order("created_at", { ascending: false })
  } else {
    propositionQuery = propositionQuery.order("votes_count", { ascending: false })
  }

  const { data: propositions } = await propositionQuery.limit(limit)
  const sortedPropositions = [...(propositions ?? [])].sort((a, b) => {
    if (statusSort === "status") {
      const statusA = a.status ?? "Open"
      const statusB = b.status ?? "Open"
      const compare = statusA.localeCompare(statusB)
      return statusOrder === "asc" ? compare : -compare
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

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.startsWith("http")
      ? process.env.NEXT_PUBLIC_APP_URL
      : "https://www.forom.app"

  const createUrl = new URL("/propositions/create", appUrl)
  createUrl.searchParams.set("page", page.id)
  if (page.name) createUrl.searchParams.set("pageName", page.name)
  if (query) createUrl.searchParams.set("title", query)

  const embedBasePath = `/${locale}/embed/pages/${slug}/propositions`
  const frameThemeClass =
    theme === "dark"
      ? "dark bg-slate-950 text-slate-100"
      : "bg-muted/20 text-foreground"

  return (
    <div className={frameThemeClass}>
      <main className="mx-auto w-full max-w-5xl p-4 md:p-6">
        <Card>
          <CardHeader className="space-y-3 pb-3">
            <CardTitle className="text-xl md:text-2xl">
              {tEmbed("title", { pageName: page.name })}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{tEmbed("subtitle")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <PagePropositionSearch
              slug={slug}
              initialQuery={query}
              status={status}
              sort={sort}
              statusSort={statusSort}
              statusOrder={statusOrder}
              basePath={embedBasePath}
              theme={theme}
              limit={limit}
            />
            <PagePropositionsTable
              pageId={page.id}
              pageName={page.name}
              initialItems={sortedPropositions as {
                id: string
                title: string | null
                status: string | null
                votes_count: number | null
              }[]}
              initialVotedIds={initialVotedIds}
              query={query}
              status={status}
              sort={sort}
              statusSort={statusSort}
              statusOrder={statusOrder}
              pageSize={limit}
              emptyStateText={tEmbed("noMatchingResults")}
              emptyActionLabel={tEmbed("addOnForom")}
              emptyActionHref={createUrl.toString()}
              emptyActionOpenNewTab
              itemLinkPrefix={`/${locale}/propositions`}
              itemLinkOpenNewTab
            />
            <div className="pt-1 text-center text-xs text-muted-foreground">
              {tEmbed("poweredBy")}{" "}
              <Link
                href={appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground hover:underline"
              >
                FOROM
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}