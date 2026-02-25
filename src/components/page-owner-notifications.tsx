"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
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
    <div className="space-y-4 text-sm">
      <p className="font-medium text-foreground">{t("title")}</p>
      <div className="flex items-center justify-between gap-3">
        <label
          id="page-owner-daily-label"
          htmlFor="page-owner-daily"
          className="text-sm text-foreground"
        >
          {t("dailySummary")}
        </label>
        <ToggleSwitch
          id="page-owner-daily"
          ariaLabelledBy="page-owner-daily-label"
          checked={daily}
          onCheckedChange={setDaily}
        />
      </div>
      <div className="space-y-2">
        <label
          htmlFor="page-owner-threshold"
          className="text-sm font-medium text-foreground"
        >
          {t("voteThreshold")}
        </label>
        <Input
          id="page-owner-threshold"
          name="voteThreshold"
          value={threshold}
          onChange={(event) => setThreshold(event.target.value)}
          placeholder={t("thresholdPlaceholder")}
          className="h-11"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? tCommon("saving") : tCommon("save")}
        </Button>
      </div>
    </div>
  )
}