"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { AtSign, Camera, Instagram, Linkedin, Mail, User } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { PageVerificationRequest } from "@/components/page-verification-request"
import { ProfileNotifications } from "@/components/profile-notifications"
import { getStatusKey, getStatusToneClass } from "@/lib/status-labels"

type Profile = {
  username: string | null
  email: string | null
  avatar_url: string | null
  full_name?: string | null
  country?: string | null
  city?: string | null
  bio?: string | null
  linkedin?: string | null
  instagram?: string | null
  tiktok?: string | null
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
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [linkedin, setLinkedin] = useState("")
  const [instagram, setInstagram] = useState("")
  const [tiktok, setTiktok] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const emailValue = profile?.email ?? userEmailFallback

  // Sync displayed tab with URL param (?view=...)
  useEffect(() => {
    setView(urlView)
  }, [urlView])

  useEffect(() => {
    setName((profile?.full_name ?? profile?.username ?? "").trim())
    setUsername((profile?.username ?? "").trim())
    setBio((profile?.bio ?? "").trim())
    setLinkedin((profile?.linkedin ?? "").trim())
    setInstagram((profile?.instagram ?? "").trim())
    setTiktok((profile?.tiktok ?? "").trim())
  }, [
    profile?.full_name,
    profile?.username,
    profile?.bio,
    profile?.linkedin,
    profile?.instagram,
    profile?.tiktok,
  ])

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    setProfileError(null)
    setProfileMessage(null)
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          username,
          bio,
          linkedin,
          instagram,
          tiktok,
        }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null
      if (!response.ok || !payload?.ok) {
        setProfileError(payload?.error ?? "Unable to save profile.")
        return
      }
      setProfileMessage("Profile updated.")
    } catch {
      setProfileError("Unable to save profile.")
    } finally {
      setSavingProfile(false)
    }
  }

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
          <button
            type="button"
            onClick={() => setView("notifications")}
            className="rounded-md px-2 py-1.5 text-left hover:bg-muted"
          >
            {tProfile("notificationSettings")}
          </button>
        </nav>
      </aside>

      {/* Main content on the right: one panel at a time */}
      <div className="flex-1 space-y-6">
        {view === "profil" && (
          <section id="profil">
            <Card>
              <CardHeader>
                <CardTitle>{tProfile("myProfile")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative pb-3">
                    <button
                      type="button"
                      className="group relative rounded-full"
                      aria-label="Upload profile picture"
                    >
                      <Avatar
                        src={profile?.avatar_url ?? null}
                        name={profile?.username ?? profile?.email ?? userEmailFallback}
                        size="lg"
                        className="h-40 w-40 text-3xl ring-2 ring-primary/80 ring-offset-2 ring-offset-background"
                      />
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <Camera className="size-6 text-white" />
                      </span>
                    </button>
                    <Badge variant="secondary" className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                      {tProfile("levelLabel", { count: doneCount ?? 0 })}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-center">
                    <p className="text-sm font-medium text-foreground">
                      Click on the image to upload a new profile picture
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supported formats: JPEG, PNG, GIF, WebP (max 5MB)
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-foreground">Name</label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="pl-10"
                        placeholder="Your name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-foreground">Username</label>
                    <div className="relative">
                      <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        className="pl-10"
                        placeholder="@username"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-foreground">Email</label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input value={emailValue} className="pl-10" disabled readOnly />
                    </div>
                    <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-foreground">Bio</label>
                    <Textarea
                      value={bio}
                      onChange={(event) => setBio(event.target.value)}
                      rows={4}
                      placeholder="Tell us about yourself..."
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <p className="text-lg font-semibold text-foreground">Social Links</p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-foreground">Linkedin</label>
                    <div className="relative">
                      <Linkedin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={linkedin}
                        onChange={(event) => setLinkedin(event.target.value)}
                        className="pl-10"
                        placeholder="https://linkedin.com/in/yourprofile"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-foreground">Instagram</label>
                    <div className="relative">
                      <Instagram className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={instagram}
                        onChange={(event) => setInstagram(event.target.value)}
                        className="pl-10"
                        placeholder="https://instagram.com/yourprofile"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-foreground">TikTok</label>
                    <Input
                      value={tiktok}
                      onChange={(event) => setTiktok(event.target.value)}
                      placeholder="https://tiktok.com/@yourprofile"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <Button onClick={handleSaveProfile} disabled={savingProfile}>
                    {savingProfile ? "Saving..." : "Save Changes"}
                  </Button>
                </div>

                {profileError ? (
                  <p className="text-sm text-destructive">{profileError}</p>
                ) : null}
                {profileMessage ? (
                  <p className="text-sm text-emerald-600">{profileMessage}</p>
                ) : null}
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
                      <Badge
                        variant="outline"
                        className={getStatusToneClass(item.status)}
                      >
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
                <CardTitle>{tProfile("myPages")}</CardTitle>
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
