"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { OnboardingShell } from "@/components/onboarding/onboarding-shell"
import { sanitizeNextPath } from "@/lib/security/auth-modal-state"

export default function OnboardingPreviewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [completed, setCompleted] = useState(false)
  const nextPath = useMemo(
    () => sanitizeNextPath(searchParams.get("next")),
    [searchParams]
  )
  const forceWelcome = useMemo(
    () => searchParams.get("welcome") === "1",
    [searchParams]
  )

  useEffect(() => {
    if (!completed) return
    router.replace(nextPath || "/")
  }, [completed, nextPath, router])

  if (completed) return null

  return (
    <OnboardingShell
      initialUsername=""
      initialAvatarUrl=""
      forceWelcome={forceWelcome}
      onCompleted={() => setCompleted(true)}
    />
  )
}
