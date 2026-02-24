"use client"

import { Link } from "@/i18n/navigation"
import { AuthStatus } from "@/components/auth-status"

type SessionUser = {
  id: string
  email?: string | null
  user_metadata?: { username?: string | null } | null
}

type TopPageHeaderProps = {
  backHref?: string
  backLabel: string
  initialSession?: { user: SessionUser } | null
}

export function TopPageHeader({
  backHref = "/",
  backLabel,
  initialSession,
}: TopPageHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3">
      <Link
        href={backHref}
        className="link-nav inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        {backLabel}
      </Link>
      <AuthStatus initialSession={initialSession} />
    </header>
  )
}
