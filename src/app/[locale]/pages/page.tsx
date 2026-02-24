import Link from "next/link"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { TopPageHeader } from "@/components/top-page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getServerSessionUser, getSupabaseServerClient } from "@/utils/supabase/server"

type Props = { params: Promise<{ locale: string }> }

export default async function PagesIndex({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const [t, tNav, serverUser] = await Promise.all([
    getTranslations("PagesIndex"),
    getTranslations("Nav"),
    getServerSessionUser(),
  ])
  const initialSession = serverUser != null ? { user: serverUser } : null
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return (
      <div className="min-h-screen bg-muted/40 px-6 py-16">
        <div className="mx-auto w-full max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>{t("supabaseNotConfiguredTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              {t("supabaseNotConfiguredBody")}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { data: pages } = await supabase
    .from("pages")
    .select("id, name, slug, is_verified, reactivity_score, certification_type")
    .order("name", { ascending: true })

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <TopPageHeader
          backHref="/"
          backLabel={`← ${tNav("back")}`}
          initialSession={initialSession}
        />
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </header>

        <div className="grid gap-3">
          {(pages ?? []).map((page) => (
            <Card key={page.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {page.slug ? (
                    <Link
                      href={`/pages/${page.slug}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {page.name}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">
                      {page.name}
                    </span>
                  )}
                  {page.reactivity_score !== null && (
                    <p className="text-xs text-muted-foreground">
                      {t("scoreLabel", { score: page.reactivity_score })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge
                    variant={
                      page.is_verified || page.certification_type === "OFFICIAL"
                        ? "default"
                        : "outline"
                    }
                  >
                    {page.is_verified || page.certification_type === "OFFICIAL"
                      ? t("verifiedBadge")
                      : t("publicBadge")}
                  </Badge>
                  {!page.slug && (
                    <Badge variant="outline">{t("missingSlug")}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {pages?.length === 0 && (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                {t("emptyState")}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}