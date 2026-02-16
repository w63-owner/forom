import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PropositionStatusBadge } from "@/components/proposition-status-badge"
import { PropositionVoteBar } from "@/components/proposition-vote-bar"
import { PropositionEditLink } from "@/components/proposition-edit-link"
import { PropositionDeleteButton } from "@/components/proposition-delete-button"
import { PropositionNotifyButton } from "@/components/proposition-notify-button"
import { PropositionActionsMenu } from "@/components/proposition-actions-menu"
import { SanitizedHtml } from "@/components/sanitized-html"
import {
  PropositionVolunteersProvider,
  PropositionVolunteerButton,
} from "@/components/proposition-volunteers"
import { BackLink } from "@/components/back-link"
import { relativeTime } from "@/lib/utils"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import PropositionDetailClient from "./proposition-detail-client"

type Props = {
  params: Promise<{ id: string; locale: string }>
}

const stripHtml = (value: string | null | undefined) =>
  value ? value.replace(/<[^>]*>/g, "").trim() : ""

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, locale } = await params
  const supabase = await getSupabaseServerClient()
  if (!supabase) return {}
  const { data } = await supabase
    .from("propositions")
    .select("title, description")
    .eq("id", id)
    .maybeSingle()
  if (!data) return {}
  const description =
    stripHtml(data.description) || "Plateforme de feedback collaboratif."
  return {
    title: data.title ?? "FOROM",
    description,
    openGraph: {
      title: data.title ?? "FOROM",
      description,
      url: `/${locale}/propositions/${id}`,
    },
  }
}

export default async function PropositionDetails({ params }: Props) {
  const locale = await getLocale()
  const t = await getTranslations("PropositionDetail")
  const { id } = await params
  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  )

  if (!isValidUuid) {
    notFound()
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return (
      <div className="min-h-screen bg-muted/40 px-6 py-16">
        <div className="mx-auto w-full max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>{t("supabaseNotConfiguredTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              {t("supabaseNotConfiguredBody")}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { data, error } = await supabase
    .from("propositions")
    .select("id, title, description, status, votes_count, page_id, author_id, created_at, image_urls, users!author_id(username, email)")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    return (
      <div className="min-h-screen bg-muted/40 px-6 py-16">
        <div className="mx-auto w-full max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>{t("supabaseErrorTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {error.message}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-muted/40 px-6 py-16">
        <div className="mx-auto w-full max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>{t("notFoundTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {t("notFoundBody", { id })}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const pageData = data.page_id
    ? (
        await supabase
          .from("pages")
          .select("name, slug, owner_id")
          .eq("id", data.page_id)
          .maybeSingle()
      ).data ?? null
    : null

  const { data: volunteersData } = await supabase
    .from("volunteers")
    .select("user_id, skills_offered, status, created_at, users(username, email, avatar_url)")
    .eq("proposition_id", data.id)
    .order("created_at", { ascending: true })

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()
  let initialHasVoted: boolean | undefined
  if (currentUser) {
    const { data: existingVote } = await supabase
      .from("votes")
      .select("id")
      .eq("proposition_id", data.id)
      .eq("user_id", currentUser.id)
      .eq("type", "Upvote")
      .maybeSingle()
    initialHasVoted = Boolean(existingVote)
  }

  type VolunteerRow = {
    user_id: string
    skills_offered: string | null
    status: string
    users?: { username: string | null; email: string | null; avatar_url: string | null } | { username: string | null; email: string | null; avatar_url: string | null }[] | null
  }
  const initialVolunteers = (volunteersData ?? []).map((v: VolunteerRow) => {
    const u = Array.isArray(v.users) ? v.users[0] ?? null : v.users ?? null
    return {
      user_id: v.user_id,
      skills_offered: v.skills_offered ?? null,
      status: v.status,
      username: u?.username ?? null,
      email: u?.email ?? null,
      avatar_url: u?.avatar_url ?? null,
    }
  })

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <BackLink className="link-nav inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" />
        <div className="relative">
          <PropositionVolunteersProvider
            propositionId={data.id}
            isOrphan={data.page_id == null}
            initialVolunteers={initialVolunteers}
          >
            <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
              <div className="md:hidden">
                <PropositionActionsMenu
                  propositionId={data.id}
                  authorId={data.author_id}
                />
              </div>
              <div className="hidden items-center gap-2 md:flex">
                <PropositionVolunteerButton />
                <PropositionEditLink
                  propositionId={data.id}
                  authorId={data.author_id}
                />
                <PropositionDeleteButton
                  propositionId={data.id}
                  authorId={data.author_id}
                  className="text-destructive hover:text-destructive"
                />
                <PropositionNotifyButton propositionId={data.id} />
              </div>
            </div>
          <Card>
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="w-fit" variant="secondary">
                  Proposition
                </Badge>
                {pageData?.name &&
                  (pageData.slug ? (
                    <Badge variant="outline" asChild>
                      <Link href={`/pages/${pageData.slug}`}>
                        {pageData.name}
                      </Link>
                    </Badge>
                  ) : (
                    <Badge variant="outline">{pageData.name}</Badge>
                  ))}
                <PropositionStatusBadge
                  propositionId={data.id}
                  initialStatus={data.status ?? "Open"}
                  pageOwnerId={pageData?.owner_id ?? null}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="min-w-0 text-2xl">{data.title}</CardTitle>
                <div className="shrink-0">
                  <PropositionVoteBar
                    propositionId={data.id}
                    initialVotes={data.votes_count ?? 0}
                    initialHasVoted={initialHasVoted}
                    propositionPageId={data.page_id}
                  />
                </div>
              </div>
              {(() => {
                const users = data.users as { username: string | null; email: string | null } | { username: string | null; email: string | null }[] | null
                const author = Array.isArray(users) ? users[0] ?? null : users
                const authorName =
                  author?.username || author?.email || t("anonymous")
                return (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{authorName}</span>
                    <span className="ml-1.5">
                      {relativeTime(
                        data.created_at ?? new Date().toISOString(),
                        locale
                      )}
                    </span>
                  </p>
                )
              })()}
            </CardHeader>
            <CardContent className="space-y-4">
              {data.description?.replace(/<[^>]*>/g, "").trim() ? (
                <SanitizedHtml
                  html={data.description ?? ""}
                  className="prose prose-sm max-w-none text-[#333D42] dark:prose-invert"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("noDescription")}
                </p>
              )}
              {(() => {
                const imageUrls = data.image_urls as { url: string; caption?: string }[] | null
                const images = Array.isArray(imageUrls) && imageUrls.length > 0 ? imageUrls : null
                if (!images) return null
                return (
                  <div className="space-y-2">
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {images.map((item, index) => (
                        <li key={index} className="overflow-hidden rounded-lg border border-border bg-muted/30">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block aspect-video w-full"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.url}
                              alt={item.caption ?? `Image ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                          </a>
                          {item.caption && (
                            <p className="p-2 text-xs text-muted-foreground">{item.caption}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
          </PropositionVolunteersProvider>
        </div>

        <PropositionDetailClient
          propositionId={data.id}
          propositionAuthorId={data.author_id}
        />
      </div>
    </div>
  )
}