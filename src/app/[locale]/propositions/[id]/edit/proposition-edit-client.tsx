"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import debounce from "lodash/debounce"
import { ImageIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getSupabaseClient } from "@/utils/supabase/client"
import { DISCOVER_CATEGORIES_BY_UNIVERSE } from "@/lib/discover-categories"
import type { Universe } from "@/types/schema"
import { UNIVERSE_SLUGS } from "@/types/schema"

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
  initialUniverse: string | null
  initialCategory: string
  initialSubCategory: string
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
  initialUniverse,
  initialCategory,
  initialSubCategory,
  initialNotifyComments,
  initialNotifyVolunteers,
  initialNotifySolutions,
  initialImageUrls,
}: Props) {
  const router = useRouter()
  const t = useTranslations("PropositionEdit")
  const tDiscover = useTranslations("Discover")
  const tCommon = useTranslations("Common")
  const locale = useLocale()
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [linkChoice, setLinkChoice] = useState(initialPage ? "existing" : "none")
  const [pageQuery, setPageQuery] = useState(initialPage?.name ?? "")
  const [pageResults, setPageResults] = useState<PageResult[]>([])
  const [pageLoading, setPageLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [selectedPage, setSelectedPage] = useState<PageResult | null>(initialPage)
  const [universe, setUniverse] = useState<Universe | null>(
    initialUniverse as Universe | null
  )
  const [category, setCategory] = useState(initialCategory)
  const [subCategory, setSubCategory] = useState(initialSubCategory)
  const [categoryQuery, setCategoryQuery] = useState("")
  const [categoryOpen, setCategoryOpen] = useState(false)
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

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  const universeCategories = (Object.keys(UNIVERSE_SLUGS) as Universe[]).map(
    (u) => ({
      universe: u,
      universeLabel: tDiscover(`universe_${u}`),
      categories:
        (DISCOVER_CATEGORIES_BY_UNIVERSE[u] ?? []).map((c) => ({
          category: c.category,
          subCategories: c.subCategories ?? [],
        })),
    })
  )

  const q = categoryQuery.trim().toLowerCase()
  const filtered = q
    ? universeCategories
        .map((uc) => ({
          ...uc,
          categories: uc.categories
            .map((c) => ({
              ...c,
              matchingSubs: c.subCategories.filter((s) =>
                s.toLowerCase().includes(q)
              ),
            }))
            .filter(
              (c) =>
                uc.universeLabel.toLowerCase().includes(q) ||
                c.category.toLowerCase().includes(q) ||
                c.matchingSubs.length > 0
            ),
        }))
        .filter(
          (uc) =>
            uc.categories.length > 0 || uc.universeLabel.toLowerCase().includes(q)
        )
    : universeCategories.map((uc) => ({
        ...uc,
        categories: uc.categories.map((c) => ({
          ...c,
          matchingSubs: c.subCategories,
        })),
      }))

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectedLabel =
    subCategory || category || (universe ? tDiscover(`universe_${universe}`) : "")

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
          setPageError(t("supabaseNotConfigured"))
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
      setError(t("supabaseNotConfigured"))
      return
    }

    setLoading(true)
    setError(null)
    try {
      if (linkChoice === "existing" && !selectedPage) {
        setError(t("selectExistingPageError"))
        return
      }

      const descriptionText = stripHtml(description)
      const imageUrls: { url: string; caption?: string }[] = [...existingImages]
      const hasNewImages = imageFiles.some(Boolean)
      if (hasNewImages) {
        const ensureRes = await fetch(`/api/ensure-storage-bucket?locale=${locale}`, {
          method: "POST",
        })
        if (!ensureRes.ok) {
          const body = await ensureRes.json().catch(() => ({}))
          setError(
            body?.error ??
              t("imageStorageError")
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
              ? t("imageBucketMissing")
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
          universe: universe ?? null,
          category: category || null,
          sub_category: subCategory || null,
          notify_comments: notifyComments,
          notify_volunteers: notifyVolunteers,
          notify_solutions: notifySolutions,
          image_urls: imageUrls,
        })
        .eq("id", propositionId)

      if (updateError) {
        const isDuplicate =
          updateError.code === "23505" ||
          updateError.message?.toLowerCase().includes("unique") ||
          updateError.message?.toLowerCase().includes("duplicate")
        setError(
          isDuplicate
            ? t("duplicatePropositionError")
            : updateError.message
        )
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
          ← {tCommon("back")}
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                id="proposition-edit-title"
                name="title"
                value={title}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setTitle(e.target.value)
                }
                placeholder={t("titlePlaceholder")}
              />
            </div>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder={t("descriptionPlaceholder")}
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
                        aria-label={t("removeImageAria")}
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
                        aria-label={t("removeImageAria")}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex min-h-[64px] min-w-[80px] flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-input bg-muted/30 px-2 py-3 text-center text-xs text-muted-foreground hover:bg-muted/50">
                      <input
                        id={`proposition-edit-image-${index + 1}`}
                        name={`image-${index + 1}`}
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
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">
                {t("categoryTitle")}
              </h3>
              <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                <PopoverAnchor asChild>
                  <Input
                    id="proposition-edit-category"
                    name="category"
                    value={categoryOpen ? categoryQuery : selectedLabel}
                    onChange={(e) => {
                      const value = e.target.value
                      setCategoryQuery(value)
                      if (!value.trim()) {
                        setUniverse(null)
                        setCategory("")
                        setSubCategory("")
                      }
                      if (!categoryOpen) setCategoryOpen(true)
                    }}
                    onFocus={() => setCategoryOpen(true)}
                    placeholder={t("categoryPlaceholder")}
                  />
                </PopoverAnchor>
                <PopoverContent className="max-h-80 w-[var(--radix-popover-trigger-width)] overflow-y-auto p-1">
                  <div className="space-y-0.5">
                    {filtered.map((uc) => (
                      <div key={uc.universe} className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setUniverse(uc.universe)
                            setCategory("")
                            setSubCategory("")
                            setCategoryQuery(uc.universeLabel)
                            setCategoryOpen(false)
                          }}
                          className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                        >
                          {uc.universeLabel}
                        </button>
                        {uc.categories.map((cat) => {
                          const key = `${uc.universe}::${cat.category}`
                          const hasSubs = cat.subCategories.length > 0
                          const hasMatchingSubs = q && (cat.matchingSubs?.length ?? 0) > 0
                          const isExpanded = expandedKeys.has(key) || hasMatchingSubs
                          const subsToShow = hasMatchingSubs ? cat.matchingSubs! : cat.subCategories
                          return (
                            <div key={key} className="space-y-0.5">
                              <div className="flex items-center gap-0.5">
                                {hasSubs ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpanded(key)}
                                    className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                                    aria-label={
                                      isExpanded
                                        ? tCommon("collapse")
                                        : tCommon("expand")
                                    }
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="size-4" />
                                    ) : (
                                      <ChevronRight className="size-4" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="size-6 shrink-0" />
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUniverse(uc.universe)
                                    setCategory(cat.category)
                                    setSubCategory("")
                                    setCategoryQuery(cat.category)
                                    setCategoryOpen(false)
                                  }}
                                  className="flex-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                >
                                  {cat.category}
                                </button>
                              </div>
                              {hasSubs && isExpanded && (
                                <div className="ml-6 space-y-0.5">
                                  {subsToShow.map((sub) => (
                                    <button
                                      key={sub}
                                      type="button"
                                      onClick={() => {
                                        setUniverse(uc.universe)
                                        setCategory(cat.category)
                                        setSubCategory(sub)
                                        setCategoryQuery(sub)
                                        setCategoryOpen(false)
                                      }}
                                      className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                    >
                                      {sub}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                    {filtered.length === 0 && (
                      <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                        {t("categoryEmpty")}
                      </p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">
                {t("notificationsIntro")}
              </p>
              <label className="flex items-center gap-2">
                <input
                  id="proposition-edit-notify-comments"
                  name="notifyComments"
                  type="checkbox"
                  checked={notifyComments}
                  onChange={(e) => setNotifyComments(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                {t("notifyComments")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  id="proposition-edit-notify-volunteers"
                  name="notifyVolunteers"
                  type="checkbox"
                  checked={notifyVolunteers}
                  onChange={(e) => setNotifyVolunteers(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                {t("notifyVolunteers")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  id="proposition-edit-notify-solutions"
                  name="notifySolutions"
                  type="checkbox"
                  checked={notifySolutions}
                  onChange={(e) => setNotifySolutions(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                {t("notifySolutions")}
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
                <SelectValue placeholder={t("linkPagePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("linkNone")}</SelectItem>
                <SelectItem value="existing">{t("linkExisting")}</SelectItem>
              </SelectContent>
            </Select>
            {linkChoice === "existing" && (
              <div className="space-y-2">
                <Input
                  id="proposition-edit-page-search"
                  name="pageSearch"
                  value={pageQuery}
                  onChange={(e) => {
                    setPageQuery(e.target.value)
                    setSelectedPage(null)
                  }}
                  placeholder={t("pageSearchPlaceholder")}
                />
                {pageLoading && (
                  <p className="text-sm text-muted-foreground">
                    {t("pageSearching")}
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
                      {t("pageNotFound")}
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
                    {t("pageSelected", { name: selectedPage.name })}
                  </p>
                )}
              </div>
            )}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Button variant="ghost" asChild>
                <Link href={`/propositions/${propositionId}`}>{tCommon("cancel")}</Link>
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
                {loading ? tCommon("saving") : tCommon("save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}