import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSupabaseServerClient } from "@/utils/supabase/server"

export default async function PagesIndex() {
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

  const { data: pages } = await supabase
    .from("pages")
    .select("id, name, slug, is_verified, reactivity_score, certification_type")
    .order("name", { ascending: true })

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">Pages</h1>
          <p className="text-muted-foreground">
            Accédez aux pages et à leurs propositions associées.
          </p>
        </header>

        <div className="grid gap-3">
          {(pages ?? []).map((page) => (
            <Card key={page.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {page.slug ? (
                    <Link
                      href={`/pages/${page.slug}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {page.name}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">
                      {page.name}
                    </span>
                  )}
                  {page.reactivity_score !== null && (
                    <p className="text-xs text-muted-foreground">
                      Score {page.reactivity_score}/10
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge
                    variant={
                      page.is_verified || page.certification_type === "OFFICIAL"
                        ? "default"
                        : "outline"
                    }
                  >
                    {page.is_verified || page.certification_type === "OFFICIAL"
                      ? "Certifiée"
                      : "Publique"}
                  </Badge>
                  {!page.slug && (
                    <Badge variant="outline">Slug manquant</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {pages?.length === 0 && (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                Aucune page disponible pour le moment.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
