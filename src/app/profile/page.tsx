import Link from "next/link"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSupabaseServerClient } from "@/utils/supabase/server"

export default async function ProfilePage() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return (
      <div className="min-h-screen bg-muted/40 px-6 py-16">
        <div className="mx-auto w-full max-w-4xl">
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

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    redirect("/login?next=/profile")
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, username, email, avatar_url")
    .eq("id", userData.user.id)
    .maybeSingle()

  const { count: doneCount } = await supabase
    .from("propositions")
    .select("id", { count: "exact", head: true })
    .eq("author_id", userData.user.id)
    .eq("status", "Done")

  const { data: propositions } = await supabase
    .from("propositions")
    .select("id, title, status, created_at")
    .eq("author_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  const { data: ownedPages } = await supabase
    .from("pages")
    .select("id, name, slug")
    .eq("owner_id", userData.user.id)
    .order("name", { ascending: true })

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {profile?.username ?? "Utilisateur"} ·{" "}
              {profile?.email ?? userData.user.email}
            </p>
            <Badge variant="secondary">Niveau {doneCount ?? 0}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mes propositions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(propositions ?? []).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <Link
                  href={`/propositions/${item.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {item.title}
                </Link>
                <Badge variant="outline">{item.status ?? "Open"}</Badge>
              </div>
            ))}
            {propositions?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucune proposition pour le moment.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pages possédées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(ownedPages ?? []).map((page) => (
              <Link
                key={page.id}
                href={`/pages/${page.slug}`}
                className="block text-sm font-medium text-foreground hover:underline"
              >
                {page.name}
              </Link>
            ))}
            {ownedPages?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Vous ne possédez aucune page.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
