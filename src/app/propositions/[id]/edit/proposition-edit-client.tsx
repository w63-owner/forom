"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import debounce from "lodash/debounce"
import { ImageIcon, X } from "lucide-react"
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
  initialImageUrls: { url: string; caption?: string }[]
}

export default function PropositionEditClient({
  propositionId,
  initialTitle,
  initialDescription,
  initialPage,
  initialNotifyComments,
  initialNotifyVolunteers,
  initialNotifySolutions,
  initialImageUrls,
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
  const [existingImages, setExistingImages] = useState<
    { url: string; caption?: string }[]
  >(initialImageUrls)
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedTitle = title.trim()

  useEffect(() => {
    previewUrlsRef.current = previewUrls
    return () => {
      previewUrlsRef.current.forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
    }
  }, [previewUrls])

  const handleImageChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
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
  }

  const handleImageRemove = (index: number) => {
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
  }

  const handleExistingImageRemove = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index))
  }

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
      const timeout = setTimeout(() => {
        setPageResults([])
        setPageError(null)
        setPageLoading(false)
      }, 0)
      return () => clearTimeout(timeout)
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
    try {
      if (linkChoice === "existing" && !selectedPage) {
        setError("Sélectionnez une Page existante.")
        return
      }

      const descriptionText = stripHtml(description)
      const imageUrls: { url: string; caption?: string }[] = [...existingImages]
      const hasNewImages = imageFiles.some(Boolean)
      if (hasNewImages) {
        const ensureRes = await fetch("/api/ensure-storage-bucket", {
          method: "POST",
        })
        if (!ensureRes.ok) {
          const body = await ensureRes.json().catch(() => ({}))
          setError(
            body?.error ??
              "Impossible de préparer le stockage des images. Créez le bucket « proposition-images » dans Supabase (Storage → New bucket, public)."
          )
          return
        }
      }
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i]
        if (!file) continue
        const ext = file.name.split(".").pop() ?? "jpg"
        const path = `${propositionId}/${Date.now()}-${i}.${ext}`
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
          setError(
            isBucketMissing
              ? "Le bucket de stockage « proposition-images » n'existe pas. Ajoutez SUPABASE_SERVICE_ROLE_KEY dans .env.local pour le créer automatiquement, ou créez-le dans Supabase : Storage → New bucket → nom « proposition-images », public."
              : uploadError.message
          )
          return
        }
        const {
          data: { publicUrl },
        } = supabase.storage
          .from("proposition-images")
          .getPublicUrl(uploadData.path)
        imageUrls.push({ url: publicUrl })
      }
      const { error: updateError } = await supabase
        .from("propositions")
        .update({
          title: trimmedTitle,
          description: descriptionText ? description : null,
          page_id: selectedPage?.id ?? null,
          notify_comments: notifyComments,
          notify_volunteers: notifyVolunteers,
          notify_solutions: notifySolutions,
          image_urls: imageUrls,
        })
        .eq("id", propositionId)

      if (updateError) {
        setError(updateError.message)
        return
      }

      router.push(`/propositions/${propositionId}`)
    } finally {
      setLoading(false)
    }
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
            {existingImages.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {existingImages.map((item, index) => (
                    <div
                      key={`${item.url}-${index}`}
                      className="relative overflow-hidden rounded-lg border border-border bg-muted/30"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt={item.caption ?? `Image ${index + 1}`}
                        className="h-24 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleExistingImageRemove(index)}
                        className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5 text-muted-foreground shadow-sm hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
                        aria-label="Supprimer l'image"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                        onClick={() => handleImageRemove(index)}
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
                        onChange={(e) => handleImageChange(index, e)}
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
