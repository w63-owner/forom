"use client"

import { useLocale, useTranslations } from "next-intl"
import { Languages, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/hooks/use-translation"

type Props = {
  pageId: string
  originalDescription: string
}

export function PageDescriptionTranslatable({ pageId, originalDescription }: Props) {
  const locale = useLocale()
  const t = useTranslations("Translation")

  const { translations, loading, isShowingOriginal, translate } = useTranslation({
    sourceTable: "pages",
    sourceId: pageId,
    fields: ["description"],
    targetLang: locale,
    autoTranslate: true,
  })

  const displayDescription =
    !isShowingOriginal && translations?.description
      ? translations.description
      : originalDescription

  const hasTranslation = Boolean(translations)

  return (
    <div className="space-y-1">
      <p className="text-sm text-[#333D42]">{displayDescription}</p>
      {(hasTranslation || loading) && (
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
      )}
    </div>
  )
}
