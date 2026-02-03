import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PropositionStatusBadge } from "@/components/proposition-status-badge"
import { PropositionVoteBar } from "@/components/proposition-vote-bar"
import { PropositionEditLink } from "@/components/proposition-edit-link"
import { PropositionNotifyButton } from "@/components/proposition-notify-button"
import { relativeTime } from "@/lib/utils"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import PropositionDetailClient from "./proposition-detail-client"

type Props = {
  params: Promise<{ id: string }>
}

export default async function PropositionDetails({ params }: Props) {
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
              <CardTitle>Supabase non configuré</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Configurez les variables d'environnement Supabase.
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
    .single()

  if (error) {
    return (
      <div className="min-h-screen bg-muted/40 px-6 py-16">
        <div className="mx-auto w-full max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Erreur Supabase</CardTitle>
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
              <CardTitle>Proposition introuvable</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Aucun résultat pour l'identifiant {id}.
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
          .single()
      ).data ?? null
    : null

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Link
          href="/"
          className="link-nav inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Retour
        </Link>
        <div className="relative">
          <div className="absolute right-4 top-4 z-10 flex items-center gap-1">
            <PropositionEditLink
              propositionId={data.id}
              authorId={data.author_id}
            />
            <PropositionNotifyButton propositionId={data.id} />
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
              <CardTitle className="text-2xl">{data.title}</CardTitle>
              {(() => {
                const users = data.users as { username: string | null; email: string | null } | { username: string | null; email: string | null }[] | null
                const author = Array.isArray(users) ? users[0] ?? null : users
                const authorName = author?.username || author?.email || "Anonyme"
                return (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{authorName}</span>
                    <span className="ml-1.5">{relativeTime(data.created_at ?? new Date().toISOString())}</span>
                  </p>
                )
              })()}
              <PropositionVoteBar
                propositionId={data.id}
                initialVotes={data.votes_count ?? 0}
                initialStatus={data.status ?? "Open"}
                propositionPageId={data.page_id}
                pageOwnerId={pageData?.owner_id ?? null}
              />
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-4">
              {data.description?.replace(/<[^>]*>/g, "").trim() ? (
                <div
                  className="prose prose-sm max-w-none text-muted-foreground dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: data.description ?? "" }}
                />
              ) : (
                "Aucune description fournie pour l'instant."
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
        </div>

        <PropositionDetailClient
          propositionId={data.id}
          propositionAuthorId={data.author_id}
          propositionPageId={data.page_id}
          pageOwnerId={pageData?.owner_id ?? null}
          initialVotes={data.votes_count ?? 0}
          initialStatus={data.status ?? "Open"}
        />
      </div>
    </div>
  )
}
