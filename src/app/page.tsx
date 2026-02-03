import Link from "next/link"
import { AuthStatus } from "@/components/auth-status"
import { Button } from "@/components/ui/button"
import { Omnibar } from "@/components/omnibar"
import { getSupabaseServerClient } from "@/utils/supabase/server"

const featuredCompanies = [
  { name: "France", slug: "france" },
  { name: "Spotify", slug: "spotify" },
  { name: "Airbnb", slug: "airbnb" },
  { name: "BlaBlaCar", slug: "blablacar" },
  { name: "Decathlon", slug: "decathlon" },
  { name: "Orange", slug: "orange" },
  { name: "Doctolib", slug: "doctolib" },
  { name: "BackMarket", slug: "backmarket" },
  { name: "Vinted", slug: "vinted" },
  { name: "Leboncoin", slug: "leboncoin" },
  { name: "Leroy Merlin", slug: "leroy-merlin" },
  { name: "Carrefour", slug: "carrefour" },
  { name: "SNCF", slug: "sncf" },
  { name: "Uber", slug: "uber" },
  { name: "Amazon", slug: "amazon" },
  { name: "Apple", slug: "apple" },
  { name: "Google", slug: "google" },
  { name: "Meta", slug: "meta" },
  { name: "Microsoft", slug: "microsoft" },
  { name: "Netflix", slug: "netflix" },
]

const territoryCategories = [
  "country",
  "region",
  "city",
  "district",
  "supranational",
]

export default async function Home() {
  const supabase = await getSupabaseServerClient()
  const territoryPages =
    supabase
      ? (
          await supabase
            .from("pages")
            .select("id, name, slug")
            .in("category", territoryCategories)
            .order("name", { ascending: true })
            .limit(30)
        ).data ?? []
      : []
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-background via-muted/30 to-muted/60 px-6 py-16">
      <div className="absolute inset-x-0 top-6 flex justify-start px-6">
        <Button asChild size="sm" variant="ghost">
          <Link href="/explore">Explorer</Link>
        </Button>
      </div>
      <div className="absolute right-6 top-6">
        <AuthStatus />
      </div>
      <main className="flex w-full max-w-3xl flex-col items-center gap-6 text-center">
        <div className="space-y-3">
          <Link
            href="/pages/forom"
            className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground"
          >
            FOROM
          </Link>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Proposez, votez, construisez ensemble.
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Proposez une idée ou votez pour elle si elle existe déjà. Soyez
            informé quand elle sera réalisée.
          </p>
        </div>
        <Omnibar />
        <div className="w-full max-w-2xl space-y-4 pt-2 text-center">
          <p className="text-sm text-muted-foreground">
            Ces entreprises sont à votre écoute pour améliorer leurs
            produits/services
          </p>
          <div
            className="logo-marquee"
            style={
              { "--marquee-company-count": featuredCompanies.length } as React.CSSProperties
            }
          >
            <div className="logo-track">
              {featuredCompanies.map((company) => (
                <Link
                  key={company.slug}
                  href={`/pages/${company.slug}`}
                  className="logo-pill"
                >
                  {company.name}
                </Link>
              ))}
            </div>
            <div className="logo-track" aria-hidden="true">
              {featuredCompanies.map((company) => (
                <Link
                  key={`dup-${company.slug}`}
                  href={`/pages/${company.slug}`}
                  className="logo-pill"
                >
                  {company.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
        {territoryPages.length > 0 && (
          <div className="w-full max-w-2xl space-y-4 pt-2 text-center">
            <p className="text-sm text-muted-foreground">
              Des citoyens suggèrent des améliorations pour leur territoire
            </p>
            <div
              className="logo-marquee logo-marquee-territories"
              style={
                {
                  "--marquee-territory-count": territoryPages.length,
                  "--marquee-company-count": featuredCompanies.length,
                } as React.CSSProperties
              }
            >
              <div className="logo-track">
                {territoryPages.map((territory) => (
                  <Link
                    key={territory.id}
                    href={`/pages/${territory.slug}`}
                    className="logo-pill"
                  >
                    {territory.name}
                  </Link>
                ))}
              </div>
              <div className="logo-track" aria-hidden="true">
                {territoryPages.map((territory) => (
                  <Link
                    key={`dup-${territory.id}`}
                    href={`/pages/${territory.slug}`}
                    className="logo-pill"
                  >
                    {territory.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
