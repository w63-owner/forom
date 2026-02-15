"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"

type Props = {
  pageId: string
  ownerId: string
  initialDaily: boolean
  initialThreshold: number | null
}

export function PageOwnerNotifications({
  pageId,
  ownerId,
  initialDaily,
  initialThreshold,
}: Props) {
  const t = useTranslations("PageOwnerNotifications")
  const tCommon = useTranslations("Common")
  const [daily, setDaily] = useState(initialDaily)
  const [threshold, setThreshold] = useState(
    initialThreshold !== null ? String(initialThreshold) : ""
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError(t("supabaseNotConfigured"))
      return
    }
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (user?.id !== ownerId) {
      setError(t("notAuthorized"))
      return
    }
    setSaving(true)
    setError(null)
    const thresholdValue = threshold.trim()
    const nextThreshold = thresholdValue ? Number(thresholdValue) : null
    const { error: updateError } = await supabase
      .from("pages")
      .update({
        owner_notify_daily: daily,
        owner_vote_threshold: Number.isNaN(nextThreshold)
          ? null
          : nextThreshold,
      })
      .eq("id", pageId)
    if (updateError) {
      setError(updateError.message)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4 text-sm">
      <p className="font-medium text-foreground">{t("title")}</p>
      <label className="flex items-center gap-2 text-muted-foreground">
        <input
          id="page-owner-daily"
          name="dailySummary"
          type="checkbox"
          checked={daily}
          onChange={(event) => setDaily(event.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        {t("dailySummary")}
      </label>
      <label className="flex items-center gap-2 text-muted-foreground">
        <span>{t("voteThreshold")}</span>
        <input
          id="page-owner-threshold"
          name="voteThreshold"
          value={threshold}
          onChange={(event) => setThreshold(event.target.value)}
          placeholder={t("thresholdPlaceholder")}
          className="h-8 w-24 rounded-md border border-border bg-background px-2 text-sm"
        />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? tCommon("saving") : tCommon("save")}
        </Button>
      </div>
    </div>
  )
}