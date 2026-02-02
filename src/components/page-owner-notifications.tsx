"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { getSupabaseClient } from "@/utils/supabase/client"

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
  const [daily, setDaily] = useState(initialDaily)
  const [threshold, setThreshold] = useState(
    initialThreshold !== null ? String(initialThreshold) : ""
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError("Supabase non configuré.")
      return
    }
    const { data: userData } = await supabase.auth.getUser()
    if (userData.user?.id !== ownerId) {
      setError("Vous n'êtes pas autorisé.")
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
      <p className="font-medium text-foreground">Notifications owner</p>
      <label className="flex items-center gap-2 text-muted-foreground">
        <input
          type="checkbox"
          checked={daily}
          onChange={(event) => setDaily(event.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        Résumé quotidien
      </label>
      <label className="flex items-center gap-2 text-muted-foreground">
        <span>Seuil de votes</span>
        <input
          value={threshold}
          onChange={(event) => setThreshold(event.target.value)}
          placeholder="ex: 50"
          className="h-8 w-24 rounded-md border border-border bg-background px-2 text-sm"
        />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}
