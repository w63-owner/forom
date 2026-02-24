import { getTranslations, setRequestLocale } from "next-intl/server"
import {
  Building2,
  CheckCircle2,
  Compass,
  Lightbulb,
  Users,
} from "lucide-react"
import { Link } from "@/i18n/navigation"
import { TopPageHeader } from "@/components/top-page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HowItWorksStepper } from "@/components/how-it-works-stepper"
import { getServerSessionUser } from "@/utils/supabase/server"

type Props = { params: Promise<{ locale: string }> }

export default async function HowItWorksPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const [t, tNav] = await Promise.all([
    getTranslations("HowItWorks"),
    getTranslations("Nav"),
  ])
  const serverUser = await getServerSessionUser()
  const initialSession = serverUser != null ? { user: serverUser } : null

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto w-full max-w-5xl space-y-10">
        <TopPageHeader
          backHref="/"
          backLabel={`← ${tNav("back")}`}
          initialSession={initialSession}
        />
        <header className="rounded-2xl border border-border bg-background p-8 sm:p-10">
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-4 max-w-3xl text-base text-muted-foreground sm:text-lg">
            {t("intro")}
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <Card className="border-border/70 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Compass className="size-5 text-sky-600 dark:text-sky-400" />
                {t("goalTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{t("goalBody1")}</p>
              <p>{t("goalBody2")}</p>
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 px-3 py-3">
                <p>
                  <span className="font-medium text-foreground">{t("goalExampleTitle")}</span>
                </p>
                <p className="text-xs">
                  {t("goalExampleSentence1Prefix")}{" "}
                  <Link
                    href="/explore?q=Ajouter%20un%20mode%20sombre"
                    className="font-medium text-foreground underline"
                  >
                    {t("goalExamplePropositionLabel")}
                  </Link>{" "}
                  {t("goalExampleSentence1Middle")}{" "}
                  <Link href="/pages/google" className="font-medium text-foreground underline">
                    {t("goalExamplePageLabel")}
                  </Link>
                  .
                </p>
                <p className="text-xs">
                  {t("goalExampleSentence2BeforeBadge")}{" "}
                  <Badge
                    variant="outline"
                    className="mx-1 h-5 border-emerald-500/50 bg-emerald-50 px-2 py-0 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                  >
                    {t("exampleStep3")}
                  </Badge>{" "}
                  {t("goalExampleSentence2AfterBadge")}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5 text-sky-600 dark:text-sky-400" />
                {t("forWhoTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 px-3 py-3">
                <p className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <Users className="size-4 text-sky-600 dark:text-sky-400" />
                  {t("forWhoUsersTitle")}
                </p>
                <p className="text-xs">{t("forWhoUsersBody")}</p>
              </div>
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 px-3 py-3">
                <p className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <Building2 className="size-4 text-sky-600 dark:text-sky-400" />
                  {t("forWhoOrgTitle")}
                </p>
                <p className="text-xs">{t("forWhoOrgBody")}</p>
              </div>
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 px-3 py-3">
                <p className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <Lightbulb className="size-4 text-sky-600 dark:text-sky-400" />
                  {t("forWhoFoundersTitle")}
                </p>
                <p className="text-xs">{t("forWhoFoundersBody")}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">{t("conceptsTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="size-5 text-sky-600 dark:text-sky-400" />
                  {t("pagesTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{t("pagesBody1")}</p>
                <p>{t("pagesBody2")}</p>
                <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 px-3 py-3">
                  <p>
                    <span className="font-medium text-foreground">{t("pagesExampleTitle")}</span>
                  </p>
                  <p className="text-xs">{t("pagesExampleBody")}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="size-5 text-sky-600 dark:text-sky-400" />
                  {t("propositionsTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{t("propositionsBody1")}</p>
                <p>{t("propositionsBody2")}</p>
                <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 px-3 py-3">
                  <p>
                    <span className="font-medium text-foreground">
                      {t("propositionsExampleTitle")}
                    </span>
                  </p>
                  <p className="text-xs">{t("propositionsExampleBody")}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <HowItWorksStepper
          heading={t("stepsTitle")}
          steps={[
            { title: t("step1Title"), body: t("step1Body") },
            { title: t("step2Title"), body: t("step2Body") },
            { title: t("step3Title"), body: t("step3Body") },
            { title: t("step4Title"), body: t("step4Body") },
          ]}
        />

        <section className="grid gap-4">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-sky-600 dark:text-sky-400" />
                {t("ctaTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t("ctaBody")}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/explore"
                  className="inline-flex items-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  {t("ctaExplore")}
                </Link>
                <Link
                  href="/pages/create"
                  className="inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {t("ctaCreatePage")}
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

      </div>
    </div>
  )
}