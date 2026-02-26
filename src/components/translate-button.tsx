"use client"

import { useCallback, useEffect, useRef } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Languages, Loader2 } from "lucide-react"
import { useTranslation } from "@/hooks/use-translation"
import { Button } from "@/components/ui/button"

type TranslateButtonProps = {
  sourceTable: "propositions" | "comments"
  sourceId: string
  fields: string[]
  onTranslation: (
    translations: Record<string, string> | null,
    isOriginal: boolean
  ) => void
  /** If true, translation is fetched automatically on mount */
  autoTranslate?: boolean
}

export function TranslateButton({
  sourceTable,
  sourceId,
  fields,
  onTranslation,
  autoTranslate = false,
}: TranslateButtonProps) {
  const locale = useLocale()
  const t = useTranslations("Translation")
  const { translations, loading, error, isShowingOriginal, alreadyInTargetLang, translate } =
    useTranslation({
      sourceTable,
      sourceId,
      fields,
      targetLang: locale,
      autoTranslate,
    })

  const onTranslationRef = useRef(onTranslation)
  onTranslationRef.current = onTranslation

  useEffect(() => {
    onTranslationRef.current(
      isShowingOriginal ? null : translations,
      isShowingOriginal
    )
  }, [translations, isShowingOriginal])

  const handleClick = useCallback(() => {
    void translate()
  }, [translate])

  if (alreadyInTargetLang) return null

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
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
        : error
          ? t("error")
          : isShowingOriginal
            ? t("translate")
            : t("showOriginal")}
    </Button>
  )
}
