"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { getSupabaseClient } from "@/utils/supabase/client"

export function CreatePageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const categoryGroups = [
    {
      label: "Territoire",
      items: [
        { value: "country", label: "Pays" },
        { value: "region", label: "Région / État" },
        { value: "city", label: "Ville" },
        { value: "district", label: "Arrondissement / Quartier" },
        { value: "supranational", label: "Supranational" },
      ],
    },
    {
      label: "Organisation",
      items: [
        { value: "company", label: "Entreprise" },
        { value: "brand", label: "Marque" },
        { value: "institution", label: "Institution" },
        { value: "association", label: "Association" },
        { value: "school", label: "Établissement" },
      ],
    },
    {
      label: "Produit & Service",
      items: [
        { value: "product", label: "Produit" },
        { value: "service", label: "Service" },
        { value: "app", label: "Application" },
        { value: "website", label: "Site web" },
        { value: "platform", label: "Plateforme" },
      ],
    },
    {
      label: "Lieu & Événement",
      items: [
        { value: "place", label: "Lieu" },
        { value: "venue", label: "Établissement (magasin, restaurant…)" },
        { value: "event", label: "Événement" },
      ],
    },
    {
      label: "Média & Contenu",
      items: [
        { value: "media", label: "Média" },
        { value: "community", label: "Communauté" },
      ],
    },
    {
      label: "Autre",
      items: [{ value: "other", label: "Autre" }],
    },
  ]

  const selectedCategoryLabel =
    categoryGroups
      .flatMap((group) => group.items)
      .find((item) => item.value === category)?.label ?? ""

  useEffect(() => {
    const nextName = searchParams.get("name")
    if (nextName && !name.trim()) {
      setName(nextName)
    }
  }, [name, searchParams])

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
      const message =
        insertError?.code === "23505" ||
        insertError?.message?.includes("pages_slug_unique")
          ? "Une page avec ce nom (ou un nom très proche) existe déjà. Choisissez un nom plus distinctif."
          : insertError?.message ?? "Impossible de créer la page."
      setError(message)
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
      <div className="mx-auto w-full max-w-3xl space-y-3">
        <a
          href="/"
          className="link-nav inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Retour
        </a>
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
            <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  type="button"
                >
                  {selectedCategoryLabel || "Choisir une catégorie"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="max-h-80 w-[var(--radix-popover-trigger-width)] overflow-y-auto p-0">
                <Command>
                  <CommandInput placeholder="Rechercher une catégorie..." />
                  {categoryGroups.map((group) => (
                    <CommandGroup key={group.label} heading={group.label}>
                      {group.items.map((item) => (
                        <CommandItem
                          key={item.value}
                          value={item.label}
                          onSelect={() => {
                            setCategory(item.value)
                            setCategoryOpen(false)
                          }}
                        >
                          {item.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </Command>
              </PopoverContent>
            </Popover>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {successMessage && (
              <p className="text-sm text-muted-foreground">{successMessage}</p>
            )}
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-end">
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
