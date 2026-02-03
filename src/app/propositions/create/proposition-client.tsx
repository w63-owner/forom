"use client"

import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import debounce from "lodash/debounce"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

type PropositionResult = {
  id: string
  title: string
}

type PageResult = {
  id: string
  name: string
  slug: string
}

type Props = {
  initialTitle?: string
  initialPageSlug?: string
}

const sanitizeQuery = (value: string) => value.replace(/[%_]/g, "\\$&")
const stripHtml = (value: string) => value.replace(/<[^>]*>/g, "").trim()

export default function CreatePropositionClient({
  initialTitle = "",
  initialPageSlug = "",
}: Props) {
  const router = useRouter()

  const [step, setStep] = useState(initialTitle.trim() ? 3 : 1)
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState("")
  const [linkChoice, setLinkChoice] = useState(
    initialPageSlug.trim() ? "existing" : "none"
  )
  const [pageQuery, setPageQuery] = useState("")
  const [pageResults, setPageResults] = useState<PageResult[]>([])
  const [pageLoading, setPageLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [selectedPage, setSelectedPage] = useState<PageResult | null>(null)
  const [initialPageLoaded, setInitialPageLoaded] = useState(!initialPageSlug.trim())
  const [similarResults, setSimilarResults] = useState<PropositionResult[]>([])
  const [similarLoading, setSimilarLoading] = useState(false)
  const [similarError, setSimilarError] = useState<string | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [notifyComments, setNotifyComments] = useState(true)
  const [notifyVolunteers, setNotifyVolunteers] = useState(true)
  const [notifySolutions, setNotifySolutions] = useState(true)
  const [imageFiles, setImageFiles] = useState<(File | null)[]>([
    null,
    null,
    null,
    null,
    null,
  ])

  const trimmedTitle = useMemo(() => title.trim(), [title])

  const handleImageChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!["png", "jpg", "jpeg"].includes(ext ?? "")) {
      return
    }
    setImageFiles((prev) => {
      const next = [...prev]
      next[index] = file
      return next
    })
  }

  const resetSimilarState = () => {
    setSimilarResults([])
    setSimilarError(null)
    setSimilarLoading(false)
  }

  const handleTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextTitle = event.target.value
    setTitle(nextTitle)
    if (!nextTitle.trim()) {
      resetSimilarState()
    }
  }

  const goToStep = (nextStep: number) => {
    setStep(nextStep)
    if (nextStep !== 2) {
      resetSimilarState()
    }
  }

  useEffect(() => {
    if (step !== 2 || !trimmedTitle) return

    const handle = setTimeout(async () => {
      const supabase = getSupabaseClient()
      if (!supabase) {
        setSimilarError("Supabase non configuré.")
        setSimilarResults([])
        return
      }

      setSimilarLoading(true)
      setSimilarError(null)
      const safeQuery = sanitizeQuery(trimmedTitle)
      const { data, error } = await supabase
        .from("propositions")
        .select("id, title")
        .ilike("title", `%${safeQuery}%`)
        .limit(5)

      if (error) {
        setSimilarError(error.message)
        setSimilarResults([])
      } else {
        setSimilarResults(data ?? [])
      }

      setSimilarLoading(false)
    }, 300)

    return () => clearTimeout(handle)
  }, [step, trimmedTitle])

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
    if (!initialPageSlug.trim() || initialPageLoaded) return
    const loadInitialPage = async () => {
      const supabase = getSupabaseClient()
      if (!supabase) return
      const { data } = await supabase
        .from("pages")
        .select("id, name, slug")
        .eq("slug", initialPageSlug.trim())
        .maybeSingle()
      if (data) {
        setSelectedPage(data)
        setPageQuery(data.name)
      }
      setInitialPageLoaded(true)
    }
    loadInitialPage()
  }, [initialPageSlug, initialPageLoaded])

  useEffect(() => {
    if (linkChoice !== "existing") return
    if (!pageQuery.trim()) {
      setPageResults([])
      setPageError(null)
      setPageLoading(false)
      return
    }
    debouncedPageSearch(pageQuery)
    return () => debouncedPageSearch.cancel()
  }, [debouncedPageSearch, linkChoice, pageQuery])

  const handleSubmit = async () => {
    if (!trimmedTitle) return
    if (linkChoice === "existing" && !selectedPage) {
      setSubmitError("Sélectionnez une Page existante.")
      return
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      setSubmitError("Supabase non configuré.")
      return
    }

    setSubmitLoading(true)
    setSubmitError(null)
    const { data: userData, error: userError } = await supabase.auth.getUser()
    const user = userData?.user
    if (userError || !user) {
      setSubmitError("Connectez-vous pour créer une proposition.")
      setSubmitLoading(false)
      return
    }

    const imageUrls: { url: string; caption?: string }[] = []
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i]
      if (!file) continue
      const ext = file.name.split(".").pop() ?? "jpg"
      const path = `${user.id}/${Date.now()}-${i}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("proposition-images")
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        })
      if (uploadError) {
        setSubmitError(uploadError.message)
        setSubmitLoading(false)
        return
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("proposition-images").getPublicUrl(uploadData.path)
      imageUrls.push({ url: publicUrl })
    }

    const descriptionText = stripHtml(description)
    const { data, error } = await supabase
      .from("propositions")
      .insert({
        author_id: user.id,
        title: trimmedTitle,
        description: descriptionText ? description : null,
        status: "Open",
        page_id: selectedPage?.id ?? null,
        notify_comments: notifyComments,
        notify_volunteers: notifyVolunteers,
        notify_solutions: notifySolutions,
        image_urls: imageUrls,
      })
      .select("id")
      .single()

    if (error || !data) {
      setSubmitError(error?.message ?? "Impossible de créer la proposition.")
      setSubmitLoading(false)
      return
    }

    if (selectedPage?.id) {
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "proposition_created_linked",
          propositionId: data.id,
        }),
      }).catch(() => null)
    }
    router.push(`/propositions/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Entrer une proposition
          </h1>
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Étape 1 — Le titre</CardTitle>
              <CardDescription>
                Décrivez votre idée en une phrase claire.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={title}
                onChange={handleTitleChange}
                placeholder="Ex: Mode sombre pour l'application mobile"
              />
              <div className="flex justify-end">
                <Button
                  size="lg"
                  disabled={!trimmedTitle}
                  onClick={() => goToStep(2)}
                >
                  Continuer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Étape 2 — Propositions similaires</CardTitle>
              <CardDescription>
                Vérifiez si une idée similaire existe déjà.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {similarLoading && (
                <p className="text-sm text-muted-foreground">
                  Recherche des propositions similaires...
                </p>
              )}
              {!similarLoading && similarError && (
                <p className="text-sm text-destructive">{similarError}</p>
              )}
              {!similarLoading && !similarError && similarResults.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucun résultat similaire trouvé.
                </p>
              )}
              <div className="grid gap-3">
                {similarResults.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border bg-background px-4 py-3"
                  >
                    <p className="font-medium text-foreground">{item.title}</p>
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/propositions/${item.id}`)}
                    >
                      Voir
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-between">
                <Button variant="ghost" onClick={() => goToStep(1)}>
                  Retour
                </Button>
                <Button size="lg" onClick={() => goToStep(3)}>
                  Rien ne correspond
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  value={title}
                  onChange={handleTitleChange}
                  placeholder="Nommez votre proposition"
                />
              </div>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Décrivez votre proposition"
              />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <label
                    key={`image-placeholder-${index}`}
                    className="flex flex-1 min-w-[120px] cursor-pointer items-center justify-center rounded-md border border-dashed border-input bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground hover:bg-muted/50"
                  >
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                      className="sr-only"
                      onChange={(e) => handleImageChange(index, e)}
                    />
                    {imageFiles[index]?.name ?? `Image ${index + 1} (PNG, JPG)`}
                  </label>
                ))}
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-foreground">
                  Je souhaite recevoir un e-mail lorsque :
                </p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notifyComments}
                    onChange={(event) => setNotifyComments(event.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Quelqu'un commente ma proposition
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notifyVolunteers}
                    onChange={(event) =>
                      setNotifyVolunteers(event.target.checked)
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  Quelqu'un se porte volontaire pour réaliser ma proposition
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notifySolutions}
                    onChange={(event) => setNotifySolutions(event.target.checked)}
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
                    onChange={(event) => {
                      setPageQuery(event.target.value)
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
              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
              )}
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-between">
                <Button variant="ghost" onClick={() => router.push("/")}>
                  Retour
                </Button>
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={
                    submitLoading ||
                    !trimmedTitle ||
                    (linkChoice === "existing" && !selectedPage)
                  }
                >
                  {submitLoading ? "Envoi en cours..." : "Soumettre la proposition"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
