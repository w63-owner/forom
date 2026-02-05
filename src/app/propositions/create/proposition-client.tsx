"use client"

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ImageIcon, X } from "lucide-react"
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
import { usePageSearch, type PageResult } from "@/hooks/use-page-search"

type PropositionResult = {
  id: string
  title: string
}

type Props = {
  initialTitle?: string
  initialPageSlug?: string
  initialPageName?: string
}

type Step1Props = {
  title: string
  trimmedTitle: string
  onTitleChange: (event: ChangeEvent<HTMLInputElement>) => void
  onContinue: () => void
}

type Step2Props = {
  similarLoading: boolean
  similarError: string | null
  similarResults: PropositionResult[]
  onBack: () => void
  onContinue: () => void
  onSelectSimilar: (id: string) => void
}

type Step3Props = {
  title: string
  onTitleChange: (event: ChangeEvent<HTMLInputElement>) => void
  description: string
  onDescriptionChange: (value: string) => void
  imageFiles: (File | null)[]
  previewUrls: (string | null)[]
  onImageChange: (index: number, event: ChangeEvent<HTMLInputElement>) => void
  onImageRemove: (index: number) => void
  notifyComments: boolean
  notifyVolunteers: boolean
  notifySolutions: boolean
  onNotifyCommentsChange: (checked: boolean) => void
  onNotifyVolunteersChange: (checked: boolean) => void
  onNotifySolutionsChange: (checked: boolean) => void
  linkChoice: string
  onLinkChoiceChange: (value: string) => void
  pageQuery: string
  onPageQueryChange: (value: string) => void
  pageLoading: boolean
  pageError: string | null
  pageQueryTouched: boolean
  pageResults: PageResult[]
  selectedPage: PageResult | null
  onSelectPage: (page: PageResult) => void
  submitError: string | null
  submitLoading: boolean
  onReturnHome: () => void
  onSubmit: () => void
  canSubmit: boolean
}

const sanitizeQuery = (value: string) => value.replace(/[%_]/g, "\\$&")
const stripHtml = (value: string) => value.replace(/<[^>]*>/g, "").trim()

const Step1Card = memo(function Step1Card({
  title,
  trimmedTitle,
  onTitleChange,
  onContinue,
}: Step1Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 1 — Le titre</CardTitle>
        <CardDescription>Décrivez votre idée en une phrase claire.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={title}
          onChange={onTitleChange}
          onKeyDown={(event) => {
            if (event.key === "Enter" && trimmedTitle) {
              event.preventDefault()
              event.stopPropagation()
              onContinue()
            }
          }}
          placeholder="Ex: Mode sombre pour l'application mobile"
        />
        <div className="flex justify-end">
          <Button size="lg" disabled={!trimmedTitle} onClick={onContinue}>
            Continuer
          </Button>
        </div>
      </CardContent>
    </Card>
  )
})

const Step2Card = memo(function Step2Card({
  similarLoading,
  similarError,
  similarResults,
  onBack,
  onContinue,
  onSelectSimilar,
}: Step2Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 2 — Propositions similaires</CardTitle>
        <CardDescription>
          Vérifiez si une idée similaire existe déjà.
        </CardDescription>
      </CardHeader>
      <CardContent
        className="space-y-4"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            event.stopPropagation()
            onContinue()
          }
        }}
      >
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
              <Button variant="outline" onClick={() => onSelectSimilar(item.id)}>
                Voir
              </Button>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={onBack}>
            Retour
          </Button>
          <Button size="lg" onClick={onContinue}>
            Rien ne correspond
          </Button>
        </div>
      </CardContent>
    </Card>
  )
})

const Step3Card = memo(function Step3Card({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  imageFiles,
  previewUrls,
  onImageChange,
  onImageRemove,
  notifyComments,
  notifyVolunteers,
  notifySolutions,
  onNotifyCommentsChange,
  onNotifyVolunteersChange,
  onNotifySolutionsChange,
  linkChoice,
  onLinkChoiceChange,
  pageQuery,
  onPageQueryChange,
  pageLoading,
  pageError,
  pageQueryTouched,
  pageResults,
  selectedPage,
  onSelectPage,
  submitError,
  submitLoading,
  onReturnHome,
  onSubmit,
  canSubmit,
}: Step3Props) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            value={title}
            onChange={onTitleChange}
            placeholder="Nommez votre proposition"
          />
        </div>
        <RichTextEditor
          value={description}
          onChange={onDescriptionChange}
          placeholder="Décrivez votre proposition"
        />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={`image-slot-${index}`}
              className="relative flex min-w-[80px] flex-1"
            >
              {imageFiles[index] && previewUrls[index] ? (
                <div className="relative flex min-h-[64px] min-w-[80px] flex-1 overflow-hidden rounded-md border border-input bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrls[index]!}
                    alt=""
                    className="h-full min-h-[64px] w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => onImageRemove(index)}
                    className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 text-muted-foreground shadow-sm hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
                    aria-label="Supprimer l'image"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ) : (
                <label className="flex min-h-[64px] min-w-[80px] flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-input bg-muted/30 px-2 py-3 text-center text-xs text-muted-foreground hover:bg-muted/50">
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                    className="sr-only"
                    onChange={(event) => onImageChange(index, event)}
                  />
                  <ImageIcon className="size-5 shrink-0" />
                  <span>Image {index + 1} (PNG, JPG)</span>
                </label>
              )}
            </div>
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
              onChange={(event) => onNotifyCommentsChange(event.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Quelqu&apos;un commente ma proposition
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={notifyVolunteers}
              onChange={(event) =>
                onNotifyVolunteersChange(event.target.checked)
              }
              className="h-4 w-4 rounded border-border"
            />
            Quelqu&apos;un se porte volontaire pour réaliser ma proposition
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={notifySolutions}
              onChange={(event) => onNotifySolutionsChange(event.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Ma proposition a été réalisée
          </label>
        </div>
        <Select value={linkChoice} onValueChange={onLinkChoiceChange}>
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
              onChange={(event) => onPageQueryChange(event.target.value)}
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
              pageQueryTouched &&
              pageQuery &&
              pageResults.length === 0 &&
              !selectedPage && (
                <p className="text-sm text-muted-foreground">
                  Aucune page trouvée.
                </p>
              )}
            <div className="grid gap-2">
              {pageResults.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => onSelectPage(page)}
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
        {submitError && <p className="text-sm text-destructive">{submitError}</p>}
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            onClick={onReturnHome}
            className="order-2 sm:order-1"
          >
            Retour
          </Button>
          <Button
            size="lg"
            onClick={onSubmit}
            className="order-1 sm:order-2"
            disabled={!canSubmit || submitLoading}
          >
            {submitLoading ? "Envoi en cours..." : "Soumettre la proposition"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
})

export default function CreatePropositionClient({
  initialTitle = "",
  initialPageSlug = "",
  initialPageName = "",
}: Props) {
  const router = useRouter()

  const [step, setStep] = useState(initialTitle.trim() ? 3 : 1)
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState("")
  const [linkChoice, setLinkChoice] = useState(
    initialPageSlug.trim() ? "existing" : "none"
  )
  const {
    query: pageQuery,
    setQuery: setPageQuery,
    results: pageResults,
    loading: pageLoading,
    error: pageError,
    selectedPage,
    setSelectedPage,
    touched: pageQueryTouched,
    clearResults: clearPageResults,
  } = usePageSearch({
    initialPageId: initialPageSlug,
    initialPageName,
    enabled: linkChoice === "existing",
  })
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
  const [previewUrls, setPreviewUrls] = useState<(string | null)[]>([
    null,
    null,
    null,
    null,
    null,
  ])
  const previewUrlsRef = useRef<(string | null)[]>([])

  useEffect(() => {
    previewUrlsRef.current = previewUrls
    return () => {
      previewUrlsRef.current.forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
    }
  }, [previewUrls])

  const trimmedTitle = useMemo(() => title.trim(), [title])

  const resetSimilarState = useCallback(() => {
    setSimilarResults([])
    setSimilarError(null)
    setSimilarLoading(false)
  }, [])

  const handleTitleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextTitle = event.target.value
      setTitle(nextTitle)
      if (!nextTitle.trim()) {
        resetSimilarState()
      }
    },
    [resetSimilarState]
  )

  const goToStep = useCallback(
    (nextStep: number) => {
      setStep(nextStep)
      if (nextStep !== 2) {
        resetSimilarState()
      }
    },
    [resetSimilarState]
  )

  const handleSelectSimilar = useCallback(
    (id: string) => {
      router.push(`/propositions/${id}`)
    },
    [router]
  )

  const handleSelectPage = useCallback(
    (page: PageResult) => {
      setSelectedPage(page)
      setPageQuery(page.name)
      clearPageResults()
    },
    [clearPageResults, setPageQuery, setSelectedPage]
  )

  const handleLinkChoiceChange = useCallback(
    (value: string) => {
      setLinkChoice(value)
      if (value !== "existing") {
        setSelectedPage(null)
        setPageQuery("")
        clearPageResults()
      }
    },
    [clearPageResults, setPageQuery, setSelectedPage]
  )

  const handlePageQueryChange = useCallback(
    (value: string) => {
      setPageQuery(value)
    },
    [setPageQuery]
  )

  const handleImageChange = useCallback(
    (index: number, event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      const ext = file.name.split(".").pop()?.toLowerCase()
      if (!["png", "jpg", "jpeg"].includes(ext ?? "")) {
        return
      }
      setPreviewUrls((prev) => {
        const next = [...prev]
        if (next[index]) URL.revokeObjectURL(next[index]!)
        next[index] = URL.createObjectURL(file)
        return next
      })
      setImageFiles((prev) => {
        const next = [...prev]
        next[index] = file
        return next
      })
      event.target.value = ""
    },
    []
  )

  const handleImageRemove = useCallback((index: number) => {
    setPreviewUrls((prev) => {
      const next = [...prev]
      if (next[index]) URL.revokeObjectURL(next[index]!)
      next[index] = null
      return next
    })
    setImageFiles((prev) => {
      const next = [...prev]
      next[index] = null
      return next
    })
  }, [])

  const handleReturnHome = useCallback(() => {
    router.push("/")
  }, [router])

  const canSubmit =
    trimmedTitle && (linkChoice !== "existing" || Boolean(selectedPage))

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

  // page search handled by usePageSearch hook

  const handleSubmit = useCallback(async () => {
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
    const hasImages = imageFiles.some(Boolean)
    if (hasImages) {
      const ensureRes = await fetch("/api/ensure-storage-bucket", {
        method: "POST",
      })
      if (!ensureRes.ok) {
        const body = await ensureRes.json().catch(() => ({}))
        setSubmitError(
          body?.error ??
            "Impossible de préparer le stockage des images. Créez le bucket « proposition-images » dans Supabase (Storage → New bucket, public)."
        )
        setSubmitLoading(false)
        return
      }
    }
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
        const isBucketMissing = uploadError.message
          ?.toLowerCase()
          .includes("bucket not found")
        setSubmitError(
          isBucketMissing
            ? "Le bucket de stockage « proposition-images » n'existe pas. Ajoutez SUPABASE_SERVICE_ROLE_KEY dans .env.local pour le créer automatiquement, ou créez-le dans Supabase : Storage → New bucket → nom « proposition-images », public."
            : uploadError.message
        )
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
  }, [
    description,
    imageFiles,
    linkChoice,
    notifyComments,
    notifySolutions,
    notifyVolunteers,
    router,
    selectedPage,
    trimmedTitle,
  ])

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="space-y-2">
          <Link
            href="/"
            className="link-nav inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Retour
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Entrer une proposition
          </h1>
        </div>

        {step === 1 && (
          <Step1Card
            title={title}
            trimmedTitle={trimmedTitle}
            onTitleChange={handleTitleChange}
            onContinue={() => goToStep(2)}
          />
        )}

        {step === 2 && (
          <Step2Card
            similarLoading={similarLoading}
            similarError={similarError}
            similarResults={similarResults}
            onBack={() => goToStep(1)}
            onContinue={() => goToStep(3)}
            onSelectSimilar={handleSelectSimilar}
          />
        )}

        {step === 3 && (
          <Step3Card
            title={title}
            onTitleChange={handleTitleChange}
            description={description}
            onDescriptionChange={setDescription}
            imageFiles={imageFiles}
            previewUrls={previewUrls}
            onImageChange={handleImageChange}
            onImageRemove={handleImageRemove}
            notifyComments={notifyComments}
            notifyVolunteers={notifyVolunteers}
            notifySolutions={notifySolutions}
            onNotifyCommentsChange={setNotifyComments}
            onNotifyVolunteersChange={setNotifyVolunteers}
            onNotifySolutionsChange={setNotifySolutions}
            linkChoice={linkChoice}
            onLinkChoiceChange={handleLinkChoiceChange}
            pageQuery={pageQuery}
            onPageQueryChange={handlePageQueryChange}
            pageLoading={pageLoading}
            pageError={pageError}
            pageQueryTouched={pageQueryTouched}
            pageResults={pageResults}
            selectedPage={selectedPage}
            onSelectPage={handleSelectPage}
            submitError={submitError}
            submitLoading={submitLoading}
            onReturnHome={handleReturnHome}
            onSubmit={handleSubmit}
            canSubmit={Boolean(canSubmit)}
          />
        )}
      </div>
    </div>
  )
}
