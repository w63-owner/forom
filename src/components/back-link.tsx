"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

type Props = {
  className?: string
  label?: string
}

export function BackLink({ className, label }: Props) {
  const router = useRouter()
  const tCommon = useTranslations("Common")
  const resolvedLabel = label ?? `← ${tCommon("back")}`
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={className}
    >
      {resolvedLabel}
    </button>
  )
}