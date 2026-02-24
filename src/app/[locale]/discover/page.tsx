import { getTranslations, setRequestLocale } from "next-intl/server"
import { UniverseGrid } from "@/components/universe-grid"
import { TopPageHeader } from "@/components/top-page-header"
import { getServerSessionUser, getSupabaseServerClient } from "@/utils/supabase/server"
import { UNIVERSE_SLUGS } from "@/types/schema"
import type { Universe } from "@/types/schema"

type Props = { params: Promise<{ locale: string }> }

async function fetchUniverseCounts(): Promise<Partial<Record<Universe, number>>> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return {}
  const { data, error } = await supabase.rpc("get_proposition_counts_by_universe")
  if (!error && data) {
    const rows = data as { universe: string; count: number }[]
    const results: Partial<Record<Universe, number>> = {}
    for (const r of rows) {
      if (r.universe && UNIVERSE_SLUGS[r.universe as Universe] !== undefined) {
        results[r.universe as Universe] = Number(r.count) ?? 0
      }
    }
    return results
  }
  // Fallback: RPC not available yet (before migration 0027)
  const universes = Object.keys(UNIVERSE_SLUGS) as Universe[]
  const results: Partial<Record<Universe, number>> = {}
  await Promise.all(
    universes.map(async (u) => {
      const { count } = await supabase
        .from("propositions")
        .select("*", { count: "exact", head: true })
        .eq("universe", u)
      results[u] = count ?? 0
    })
  )
  return results
}

export default async function DiscoverPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const [tDiscover, tNav, initialCounts, serverUser] = await Promise.all([
    getTranslations("Discover"),
    getTranslations("Nav"),
    fetchUniverseCounts(),
    getServerSessionUser(),
  ])
  const initialSession = serverUser != null ? { user: serverUser } : null

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <TopPageHeader
          backHref="/"
          backLabel={`← ${tNav("back")}`}
          initialSession={initialSession}
        />
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">
            {tDiscover("headerTitle")}
          </h1>
          <p className="text-muted-foreground">
            {tDiscover("headerDescription")}
          </p>
        </header>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">
            {tDiscover("universesTitle")}
          </h2>
          <UniverseGrid initialCounts={initialCounts} />
        </section>
      </div>
    </div>
  )
}