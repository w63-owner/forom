"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PageVerificationRequest } from "@/components/page-verification-request"
import { ProfileNotifications } from "@/components/profile-notifications"
import { getStatusKey } from "@/lib/status-labels"

type Profile = {
  username: string | null
  email: string | null
  avatar_url: string | null
} | null

type Proposition = {
  id: string
  title: string | null
  status: string | null
  created_at: string | null
  votes_count?: number | null
  comments?: { count: number }[] | { count: number } | null
}

type OwnedPage = {
  id: string
  name: string | null
  slug: string | null
  is_verified?: boolean | null
  certification_type?: string | null
}

type PageSubscription = {
  page_id: string
  page: { id: string; name: string | null; slug: string | null }
}

type PropositionSubscription = {
  proposition_id: string
  proposition: { id: string; title: string | null }
}

type ViewKey = "profil" | "notifications" | "mes-propositions" | "mes-pages"

type ProfileShellProps = {
  profile: Profile
  userEmailFallback: string
  doneCount: number | null
  propositions: Proposition[]
  ownedPages: OwnedPage[]
  ownerId: string
  pageSubscriptions: PageSubscription[]
  propositionSubscriptions: PropositionSubscription[]
}

export function ProfileShell({
  profile,
  userEmailFallback,
  doneCount,
  propositions,
  ownedPages,
  ownerId,
  pageSubscriptions,
  propositionSubscriptions,
}: ProfileShellProps) {
  const tProfile = useTranslations("Profile")
  const tCommon = useTranslations("Common")
  const tStatus = useTranslations("Status")
  const tVerification = useTranslations("PageVerification")
  const searchParams = useSearchParams()
  const urlView = (searchParams.get("view") as ViewKey | null) ?? "profil"
  const [view, setView] = useState<ViewKey>(urlView)

  // Sync displayed tab with URL param (?view=...)
  useEffect(() => {
    setView(urlView)
  }, [urlView])

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      {/* Left navigation panel */}
      <aside className="w-full shrink-0 rounded-xl border bg-card px-4 py-4 text-sm md:w-60">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {tProfile("mySpace")}
        </p>
        <nav className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setView("profil")}
            className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
          >
            {tProfile("myProfile")}
          </button>
          <button
            type="button"
            onClick={() => setView("notifications")}
            className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
          >
            {tProfile("notificationSettings")}
          </button>
          <button
            type="button"
            onClick={() => setView("mes-propositions")}
            className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
          >
            {tProfile("myPropositions")}
          </button>
          <button
            type="button"
            onClick={() => setView("mes-pages")}
            className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
          >
            {tProfile("myPages")}
          </button>
        </nav>
      </aside>

      {/* Main content on the right: one panel at a time */}
      <div className="flex-1 space-y-6">
        {view === "profil" && (
          <section id="profil">
            <Card>
              <CardHeader>
                <CardTitle>{tProfile("profileTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={profile?.avatar_url ?? null}
                    name={profile?.username ?? profile?.email ?? userEmailFallback}
                    size="lg"
                  />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {profile?.username ?? tCommon("user")} ·{" "}
                      {profile?.email ?? userEmailFallback}
                    </p>
                    <Badge variant="secondary" className="mt-1">
                      {tProfile("levelLabel", { count: doneCount ?? 0 })}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {view === "notifications" && (
          <section id="notifications">
            <ProfileNotifications
              pageSubscriptions={pageSubscriptions}
              propositionSubscriptions={propositionSubscriptions}
            />
          </section>
        )}

        {view === "mes-propositions" && (
          <section id="mes-propositions">
            <Card>
              <CardHeader>
                <CardTitle>{tProfile("myPropositions")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {propositions.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-1 text-sm"
                  >
                    <Link
                      href={`/propositions/${item.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {item.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {item.votes_count ?? 0} {tCommon("votes")}
                      </span>
                      <span>•</span>
                      <span>
                        {Array.isArray(item.comments)
                          ? item.comments[0]?.count ?? 0
                          : item.comments?.count ?? 0}{" "}
                        {tCommon("replies")}
                      </span>
                      <span>•</span>
                      <Badge variant="secondary">
                        {tStatus(getStatusKey(item.status))}
                      </Badge>
                    </div>
                  </div>
                ))}
                {propositions.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {tProfile("noPropositions")}
                    </p>
                    <Link
                      href="/propositions/create"
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      {tCommon("addProposition")}
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {view === "mes-pages" && (
          <section id="mes-pages">
            <Card>
              <CardHeader>
                <CardTitle>{tProfile("ownedPages")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ownedPages.map((page) => {
                  const isVerified =
                    Boolean(page.is_verified) ||
                    page.certification_type === "OFFICIAL"
                  return (
                    <div
                      key={page.id}
                      className="flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/pages/${page.slug}`}
                          className="text-sm font-medium text-foreground hover:underline"
                        >
                          {page.name}
                        </Link>
                        {isVerified && (
                          <span
                            className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-500 text-[8px] font-semibold text-white"
                            aria-label={tVerification("verifiedBadge")}
                            title={tVerification("verifiedBadge")}
                          >
                            ✓
                          </span>
                        )}
                      </div>
                      {isVerified ? (
                        <Badge variant="secondary">
                          {tVerification("verifiedBadge")}
                        </Badge>
                      ) : (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm">
                              {tVerification("requestButton")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-2" align="end">
                            <PageVerificationRequest
                              pageId={page.id}
                              ownerId={ownerId}
                              isVerified={false}
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  )
                })}
                {ownedPages.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {tProfile("noOwnedPages")}
                    </p>
                    <Link
                      href="/pages/create"
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      {tCommon("createPage")}
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </div>
  )
}
