import { setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"

type Props = { params: Promise<{ locale: string }> }

export default async function CreditsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const isFrench = locale === "fr"

  return (
    <main className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <div className="space-y-2">
          <Link
            href="/"
            className="link-nav inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            ← {isFrench ? "Retour" : "Back"}
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {isFrench ? "Crédits" : "Credits"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isFrench
              ? "Cette page liste les bibliothèques, assets et contributions utilisés dans Forom."
              : "This page lists libraries, assets, and contributions used in Forom."}
          </p>
        </div>

        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">DiceBear - Adventurer</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isFrench
              ? "Les avatars générés utilisent le style Adventurer de DiceBear, basé sur la création originale de Lisa Wischofsky."
              : "Generated avatars use DiceBear's Adventurer style, based on the original artwork by Lisa Wischofsky."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <a
              href="https://www.dicebear.com/styles/adventurer/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              DiceBear Adventurer
            </a>
            <span className="text-muted-foreground">•</span>
            <a
              href="https://www.figma.com/@LisaWischofsky"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Lisa Wischofsky
            </a>
            <span className="text-muted-foreground">• CC BY 4.0</span>
          </div>
        </section>
      </div>
    </main>
  )
}
