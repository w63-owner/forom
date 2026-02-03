"use client"

import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import debounce from "lodash/debounce"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getSupabaseClient } from "@/utils/supabase/client"

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, "").trim()
const sanitizeQuery = (value: string) => value.replace(/[%_]/g, "\\$&")

type PageResult = {
  id: string
  name: string
  slug: string
}

type Props = {
  propositionId: string
  initialTitle: string
  initialDescription: string
  initialPage: PageResult | null
  initialNotifyComments: boolean
  initialNotifyVolunteers: boolean
  initialNotifySolutions: boolean
}

export default function PropositionEditClient({
  propositionId,
  initialTitle,
  initialDescription,
  initialPage,
  initialNotifyComments,
  initialNotifyVolunteers,
  initialNotifySolutions,
}: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [linkChoice, setLinkChoice] = useState(initialPage ? "existing" : "none")
  const [pageQuery, setPageQuery] = useState(initialPage?.name ?? "")
  const [pageResults, setPageResults] = useState<PageResult[]>([])
  const [pageLoading, setPageLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [selectedPage, setSelectedPage] = useState<PageResult | null>(initialPage)
  const [notifyComments, setNotifyComments] = useState(initialNotifyComments)
  const [notifyVolunteers, setNotifyVolunteers] = useState(initialNotifyVolunteers)
  const [notifySolutions, setNotifySolutions] = useState(initialNotifySolutions)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedTitle = title.trim()

  const debouncedPageSearch = useMemo(
    () =>
      debounce(async (value: string) => {
        const supabase = getSupabaseClient()
        if (!supabase) {
          setPageError("Supabase non configuré.")
          setPageResults([])
          setPageLoading(false)
          return
        }

        const safeQuery = sanitizeQuery(value.trim())
        setPageLoading(true)
        setPageError(null)
        const { data, error } = await supabase
          .from("pages")
          .select("id, name, slug")
          .ilike("name", `%${safeQuery}%`)
          .order("name", { ascending: true })
          .limit(5)

        if (error) {
          setPageError(error.message)
          setPageResults([])
        } else {
          setPageResults(data ?? [])
        }
        setPageLoading(false)
      }, 300),
    []
  )

  useEffect(() => {
    if (linkChoice !== "existing") return
    if (!pageQuery.trim()) {
      setPageResults([])
      setPageError(null)
      setPageLoading(false)
      return
    }
    if (selectedPage && pageQuery === selectedPage.name) return
    debouncedPageSearch(pageQuery)
    return () => debouncedPageSearch.cancel()
  }, [debouncedPageSearch, linkChoice, pageQuery, selectedPage])

  const handleSubmit = async () => {
    if (!trimmedTitle) return

    const supabase = getSupabaseClient()
    if (!supabase) {
      setError("Supabase non configuré.")
      return
    }

    setLoading(true)
    setError(null)

    if (linkChoice === "existing" && !selectedPage) {
      setError("Sélectionnez une Page existante.")
      return
    }

    const descriptionText = stripHtml(description)
    const { error: updateError } = await supabase
      .from("propositions")
      .update({
        title: trimmedTitle,
        description: descriptionText ? description : null,
        page_id: selectedPage?.id ?? null,
        notify_comments: notifyComments,
        notify_volunteers: notifyVolunteers,
        notify_solutions: notifySolutions,
      })
      .eq("id", propositionId)

    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    router.push(`/propositions/${propositionId}`)
  }

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Link
          href={`/propositions/${propositionId}`}
          className="link-nav inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Retour
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Modifier la proposition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                value={title}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setTitle(e.target.value)
                }
                placeholder="Titre de la proposition"
              />
            </div>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Décrivez votre proposition"
            />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">
                Je souhaite recevoir un e-mail lorsque :
              </p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notifyComments}
                  onChange={(e) => setNotifyComments(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Quelqu&apos;un commente ma proposition
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notifyVolunteers}
                  onChange={(e) => setNotifyVolunteers(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Quelqu&apos;un se porte volontaire pour réaliser ma proposition
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notifySolutions}
                  onChange={(e) => setNotifySolutions(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Ma proposition a été réalisée
              </label>
            </div>
            <Select
              value={linkChoice}
              onValueChange={(value) => {
                setLinkChoice(value)
                if (value !== "existing") {
                  setSelectedPage(null)
                  setPageQuery("")
                  setPageResults([])
                  setPageError(null)
                  setPageLoading(false)
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Lier à une Page ?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ne pas lier (orpheline)</SelectItem>
                <SelectItem value="existing">Lier à une Page existante</SelectItem>
              </SelectContent>
            </Select>
            {linkChoice === "existing" && (
              <div className="space-y-2">
                <Input
                  value={pageQuery}
                  onChange={(e) => {
                    setPageQuery(e.target.value)
                    setSelectedPage(null)
                  }}
                  placeholder="Rechercher une Page (ex: Facebook)"
                />
                {pageLoading && (
                  <p className="text-sm text-muted-foreground">
                    Recherche de Pages...
                  </p>
                )}
                {pageError && (
                  <p className="text-sm text-destructive">{pageError}</p>
                )}
                {!pageLoading &&
                  !pageError &&
                  pageQuery &&
                  !selectedPage &&
                  pageResults.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Aucune page trouvée.
                    </p>
                  )}
                <div className="grid gap-2">
                  {pageResults.map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => {
                        setSelectedPage(page)
                        setPageQuery(page.name)
                        setPageResults([])
                      }}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="font-medium text-foreground">
                        {page.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        /pages/{page.slug}
                      </span>
                    </button>
                  ))}
                </div>
                {selectedPage && (
                  <p className="text-sm text-muted-foreground">
                    Page sélectionnée : {selectedPage.name}
                  </p>
                )}
              </div>
            )}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Button variant="ghost" asChild>
                <Link href={`/propositions/${propositionId}`}>Annuler</Link>
              </Button>
              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={
                  loading ||
                  !trimmedTitle ||
                  (linkChoice === "existing" && !selectedPage)
                }
              >
                {loading ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
