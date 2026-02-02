"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getSupabaseClient } from "@/utils/supabase/client"

export default function CreatePage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!name.trim()) return
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError("Supabase non configuré.")
      return
    }
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push("/login?next=/pages/create")
      return
    }

    setLoading(true)
    setError(null)
    const { data, error: insertError } = await supabase
      .from("pages")
      .insert({
        owner_id: userData.user.id,
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        certification_type: "NONE",
        is_verified: false,
      })
      .select("slug")
      .single()

    if (insertError || !data) {
      setError(insertError?.message ?? "Impossible de créer la page.")
      setLoading(false)
      return
    }

    setSuccessMessage(
      "Page créée. Si vous représentez une marque ou une institution, demandez une certification."
    )
    setLoading(false)
    if (data.slug) {
      router.push(`/pages/${data.slug}`)
    }
  }

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto w-full max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Créer une page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nom de la page"
            />
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description longue"
              rows={6}
            />
            <Input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Catégorie (ex: SaaS, Mobilité, Retail)"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            {successMessage && (
              <p className="text-sm text-muted-foreground">{successMessage}</p>
            )}
            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={loading || !name.trim()}>
                {loading ? "Création..." : "Créer la page"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
