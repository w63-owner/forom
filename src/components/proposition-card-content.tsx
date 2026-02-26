"use client"

import type { ReactNode } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Languages, Loader2 } from "lucide-react"
import { CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SanitizedHtml } from "@/components/sanitized-html"
import { useTranslation } from "@/hooks/use-translation"

type Props = {
  propositionId: string
  originalTitle: string
  originalDescription: string | null
  noDescriptionLabel: string
  voteBarSlot: ReactNode
  authorSlot: ReactNode
  imagesSlot?: ReactNode
}

export function PropositionCardContent({
  propositionId,
  originalTitle,
  originalDescription,
  noDescriptionLabel,
  voteBarSlot,
  authorSlot,
  imagesSlot,
}: Props) {
  const locale = useLocale()
  const t = useTranslations("Translation")

  const { translations, loading, isShowingOriginal, translate } = useTranslation({
    sourceTable: "propositions",
    sourceId: propositionId,
    fields: ["title", "description"],
    targetLang: locale,
    autoTranslate: true,
  })

  const displayTitle =
    !isShowingOriginal && translations?.title ? translations.title : originalTitle
  const displayDescription =
    !isShowingOriginal && translations?.description
      ? translations.description
      : originalDescription

  const hasTranslation = Boolean(translations)

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <CardTitle className="min-w-0 text-2xl">{displayTitle}</CardTitle>
        {voteBarSlot}
      </div>
      {authorSlot}
      <div className="space-y-4 pt-4">
        {displayDescription?.replace(/<[^>]*>/g, "").trim() ? (
          <SanitizedHtml
            html={displayDescription}
            className="prose prose-sm max-w-none text-[#333D42] dark:prose-invert"
          />
        ) : (
          <p className="text-sm text-muted-foreground">{noDescriptionLabel}</p>
        )}
        {imagesSlot}
        {(hasTranslation || loading) && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void translate()}
              disabled={loading}
              className="h-auto gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Languages className="size-3.5" />
              )}
              {loading
                ? t("translating")
                : isShowingOriginal
                  ? t("translate")
                  : t("showOriginal")}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
