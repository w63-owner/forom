"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"

export function SeedPagesButton() {
  const t = useTranslations("SeedPages")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setMessage(null)
    const response = await fetch("/api/seed-pages", { method: "POST" })
    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      setMessage(
        `${t("error")} ${detail ? `(${detail})` : ""}`.trim()
      )
      setLoading(false)
      return
    }
    setMessage(t("success"))
    setLoading(false)
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleClick} disabled={loading}>
        {loading ? t("loading") : t("button")}
      </Button>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  )
}