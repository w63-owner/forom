import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProfileShell } from "@/components/profile-shell"
import { getSupabaseServerClient } from "@/utils/supabase/server"

type Props = {
  params: Promise<{ locale: string }>
}

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations("Profile")
  const tCommon = await getTranslations("Common")
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return (
      <div className="min-h-screen bg-muted/40 px-6 py-16">
        <div className="mx-auto w-full max-w-4xl">
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

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    redirect(`/${locale}?auth=signup&next=/${locale}/profile`)
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, username, email, avatar_url")
    .eq("id", userData.user.id)
    .maybeSingle()

  const meta = userData.user.user_metadata as
    | {
        full_name?: string | null
        country?: string | null
        city?: string | null
        bio?: string | null
        linkedin?: string | null
        instagram?: string | null
        tiktok?: string | null
      }
    | undefined

  const { count: doneCount } = await supabase
    .from("propositions")
    .select("id", { count: "exact", head: true })
    .eq("author_id", userData.user.id)
    .eq("status", "Done")

  const { data: propositions } = await supabase
    .from("propositions")
    .select("id, title, status, created_at, votes_count, comments(count)")
    .eq("author_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  const { data: ownedPages } = await supabase
    .from("pages")
    .select("id, name, slug, is_verified, certification_type")
    .eq("owner_id", userData.user.id)
    .order("name", { ascending: true })

  const { data: pageSubscriptions } = await supabase
    .from("page_subscriptions")
    .select("page_id, pages(id, name, slug)")
    .eq("user_id", userData.user.id)

  const { data: propositionSubscriptions } = await supabase
    .from("proposition_subscriptions")
    .select("proposition_id, propositions(id, title)")
    .eq("user_id", userData.user.id)

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Link
          href="/"
          className="link-nav inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          ← {tCommon("back")}
        </Link>

        <ProfileShell
          profile={
            profile
              ? {
                  ...profile,
                  full_name: meta?.full_name ?? null,
                  country: meta?.country ?? null,
                  city: meta?.city ?? null,
                  bio: meta?.bio ?? null,
                  linkedin: meta?.linkedin ?? null,
                  instagram: meta?.instagram ?? null,
                  tiktok: meta?.tiktok ?? null,
                }
              : {
                  username: null,
                  email: null,
                  avatar_url: null,
                  full_name: meta?.full_name ?? null,
                  country: meta?.country ?? null,
                  city: meta?.city ?? null,
                  bio: meta?.bio ?? null,
                  linkedin: meta?.linkedin ?? null,
                  instagram: meta?.instagram ?? null,
                  tiktok: meta?.tiktok ?? null,
                }
          }
          userEmailFallback={userData.user.email ?? ""}
          doneCount={doneCount ?? 0}
          ownerId={userData.user.id}
          propositions={(propositions ?? []) as {
            id: string
            title: string | null
            status: string | null
            created_at: string | null
            votes_count: number | null
            comments: { count: number }[] | { count: number } | null
          }[]}
          ownedPages={(ownedPages ?? []) as {
            id: string
            name: string | null
            slug: string | null
            is_verified: boolean | null
            certification_type: string | null
          }[]}
          pageSubscriptions={(pageSubscriptions ?? [])
            .map((s) => {
              const page = Array.isArray(s.pages) ? s.pages[0] : s.pages
              return page ? { page_id: s.page_id, page } : null
            })
            .filter((x): x is NonNullable<typeof x> => x !== null)}
          propositionSubscriptions={(propositionSubscriptions ?? [])
            .map((s) => {
              const proposition = Array.isArray(s.propositions)
                ? s.propositions[0]
                : s.propositions
              return proposition
                ? { proposition_id: s.proposition_id, proposition }
                : null
            })
            .filter((x): x is NonNullable<typeof x> => x !== null)}
        />
      </div>
    </div>
  )
}