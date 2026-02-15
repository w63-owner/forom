import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { ChevronDown } from "lucide-react"
import { Link } from "@/i18n/navigation"

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "HowItWorks" })
  const title = `${t("faqTitle")} | FOROM`
  const description = t("faqSeoDescription")
  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/faq`,
      languages: {
        fr: "/fr/faq",
        en: "/en/faq",
      },
    },
    openGraph: {
      title,
      description,
      url: `/${locale}/faq`,
      locale,
    },
  }
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const [t, tNav] = await Promise.all([
    getTranslations("HowItWorks"),
    getTranslations("Nav"),
  ])

  const categories = [
    {
      id: "purpose",
      title: t("faqCategoryPurposeTitle"),
      items: [
        { question: t("faqPurposeQ1"), answer: t("faqPurposeA1") },
      ],
    },
    {
      id: "account",
      title: t("faqCategoryAccountTitle"),
      items: [
        { question: t("faqAccountQ1"), answer: t("faqAccountA1") },
        { question: t("faqAccountQ2"), answer: t("faqAccountA2") },
        { question: t("faqAccountQ3"), answer: t("faqAccountA3") },
        { question: t("faqAccountQ4"), answer: t("faqAccountA4") },
      ],
    },
    {
      id: "propositions",
      title: t("faqCategoryPropositionsTitle"),
      items: [
        { question: t("faqPropositionsQ1"), answer: t("faqPropositionsA1") },
        { question: t("faqPropositionsQ2"), answer: t("faqPropositionsA2") },
        { question: t("faqPropositionsQ3"), answer: t("faqPropositionsA3") },
        { question: t("faqPropositionsQ4"), answer: t("faqPropositionsA4") },
        { question: t("faqPropositionsQ5"), answer: t("faqPropositionsA5") },
        { question: t("faqPropositionsQ6"), answer: t("faqPropositionsA6") },
        { question: t("faqPropositionsQ7"), answer: t("faqPropositionsA7") },
        { question: t("faqPropositionsQ8"), answer: t("faqPropositionsA8") },
      ],
    },
    {
      id: "pages",
      title: t("faqCategoryPagesTitle"),
      items: [
        { question: t("faqPagesQ1"), answer: t("faqPagesA1") },
        { question: t("faqPagesQ2"), answer: t("faqPagesA2") },
        { question: t("faqPagesQ3"), answer: t("faqPagesA3") },
        { question: t("faqPagesQ4"), answer: t("faqPagesA4") },
        { question: t("faqPagesQ5"), answer: t("faqPagesA5") },
        { question: t("faqPagesQ6"), answer: t("faqPagesA6") },
        { question: t("faqPagesQ7"), answer: t("faqPagesA7") },
        { question: t("faqPagesQ8"), answer: t("faqPagesA8") },
      ],
    },
    {
      id: "moderation",
      title: t("faqCategoryModerationTitle"),
      items: [
        { question: t("faqModerationQ0"), answer: t("faqModerationA0") },
        { question: t("faqModerationQ1"), answer: t("faqModerationA1") },
        { question: t("faqModerationQ2"), answer: t("faqModerationA2") },
        { question: t("faqModerationQ3"), answer: t("faqModerationA3") },
        { question: t("faqModerationQ4"), answer: t("faqModerationA4") },
      ],
    },
  ]

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: categories
      .flatMap((category) => category.items)
      .map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
  }

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <header className="space-y-2">
          <Link
            href="/"
            className="link-nav inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            ← {tNav("back")}
          </Link>
          <h1 className="text-3xl font-semibold text-foreground">
            {t("faqTitle")}
          </h1>
          <p className="max-w-3xl text-muted-foreground">
            {t("faqIntro")}
          </p>
        </header>

        <div className="space-y-4">
          {categories.map((category) => (
            <section
              key={category.id}
              id={category.id}
              className="rounded-xl border border-border bg-background"
            >
              <header className="border-b border-border/70 px-5 py-4">
                <h2 className="text-lg font-normal text-foreground">{category.title}</h2>
              </header>
              <div>
                {category.items.map((item) => (
                  <details
                    key={item.question}
                    className="group border-b border-border/70 px-5 py-4 last:border-b-0"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-normal text-foreground">
                      <span>{item.question}</span>
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
    </div>
  )
}