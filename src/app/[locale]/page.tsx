import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { AuthStatus } from "@/components/auth-status"
import { Button } from "@/components/ui/button"
import { OmnibarClient } from "@/components/omnibar-client"
import { RecentPropositionsTicker } from "@/components/recent-propositions-ticker"
import {
  getServerSessionUser,
  getSupabaseServerClient,
} from "@/utils/supabase/server"
import packageJson from "../../../package.json"

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

type Props = { params: Promise<{ locale: string }> }

export default async function Home({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const [t, tNav] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Nav"),
  ])

  const [supabase, serverUser] = await Promise.all([
    getSupabaseServerClient(),
    getServerSessionUser(),
  ])
  const initialSession =
    serverUser != null ? { user: serverUser } : null
  const creditsLabel = locale === "fr" ? "Crédits" : "Credits"

  const recentPropositions =
    supabase
      ? (
          await supabase
            .from("propositions")
            .select("id, title, created_at, pages(name, slug), users!author_id(username, email)")
            .order("created_at", { ascending: false })
            .limit(20)
        ).data ?? []
      : []

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-b from-background via-muted/30 to-muted/60">
      <div className="absolute inset-x-0 top-6 flex justify-start px-6">
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link href="/discover" className="link-nav">
              {tNav("discover")}
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/faq" className="link-nav">
              {tNav("faq")}
            </Link>
          </Button>
        </div>
      </div>
      <div className="absolute right-6 top-6 flex items-center gap-2">
        <AuthStatus initialSession={initialSession} />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <main className="flex w-full max-w-3xl flex-col items-center gap-6 text-center">
        <div className="space-y-3">
          <Link
            href="/pages/forom"
            className="link-nav text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground"
          >
            FOROM
          </Link>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {t("tagline")}
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            {t("subtitle")}
          </p>
        </div>
        <OmnibarClient />
        <div className="-mt-3">
          <RecentPropositionsTicker
            items={recentPropositions.map((item) => {
              const page = Array.isArray(item.pages) ? item.pages[0] : item.pages
              const author = Array.isArray(item.users) ? item.users[0] : item.users
              const title = item.title?.trim()
              return {
                id: item.id,
                title: title ?? "",
                author: author?.username || author?.email || "",
                pageName: page?.name ?? null,
                pageSlug: page?.slug ?? null,
              }
            })}
          />
        </div>
        <div className="w-full max-w-2xl space-y-4 pt-2 text-center">
          <p className="text-sm text-muted-foreground">
            {t("companiesIntro")}
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
      </main>
      </div>
      <div className="absolute inset-x-0 bottom-6 text-center text-xs text-muted-foreground">
        <span>v{packageJson.version}</span>
        <span className="mx-2">•</span>
        <Link href="/credits" className="hover:underline">
          {creditsLabel}
        </Link>
        <span className="mx-2">•</span>
        <span>
          Created by{" "}
          <a
            href="https://www.linkedin.com/in/antonin-fourcade-71464892/"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground hover:underline"
          >
            Antonin
          </a>
        </span>
      </div>
    </div>
  )
}
