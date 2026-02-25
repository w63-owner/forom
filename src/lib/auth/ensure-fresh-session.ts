"use client"

import type { SupabaseClient } from "@supabase/supabase-js"

export type EnsureFreshSessionResult =
  | { ok: true; userId: string }
  | { ok: false; kind: "unauthenticated" | "transient" | "unknown"; reason?: string | null }

const isTransientSessionReason = (reason: string | null | undefined): boolean => {
  if (!reason) return false
  const normalized = reason.toLowerCase()
  return (
    normalized.includes("timeout") ||
    normalized.includes("network") ||
    normalized.includes("fetch") ||
    normalized.includes("refresh")
  )
}

export async function ensureFreshSession(
  supabase: SupabaseClient,
  options?: { attempts?: number }
): Promise<EnsureFreshSessionResult> {
  const attempts = Math.max(1, options?.attempts ?? 2)
  let lastReason: string | null = null
  let sawTransient = false

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error) {
        lastReason = error.message
        if (isTransientSessionReason(error.message)) {
          sawTransient = true
          continue
        }
        return { ok: false, kind: "unknown", reason: lastReason }
      }
      if (data?.user?.id) {
        return { ok: true, userId: data.user.id }
      }
      return { ok: false, kind: "unauthenticated", reason: "no_active_session" }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown_error"
      lastReason = reason
      if (isTransientSessionReason(reason)) {
        sawTransient = true
        continue
      }
      return { ok: false, kind: "unknown", reason }
    }
  }

  if (sawTransient) {
    return { ok: false, kind: "transient", reason: lastReason }
  }

  return { ok: false, kind: "unknown", reason: lastReason }
}
