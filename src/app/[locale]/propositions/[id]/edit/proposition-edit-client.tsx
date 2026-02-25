"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import debounce from "lodash/debounce"
import { ImageIcon, X } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
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
import { ToggleSwitch } from "@/components/ui/toggle-switch"
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

type NotificationToggleProps = {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function NotificationToggle({
  id,
  label,
  checked,
  onCheckedChange,
}: NotificationToggleProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label id={`${id}-label`} htmlFor={id} className="text-sm text-foreground">
        {label}
      </label>
      <ToggleSwitch
        id={id}
        ariaLabelledBy={`${id}-label`}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
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
  const tCreate = useTranslations("PropositionCreate")
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
  const uploadedImages = imageFiles
    .map((file, index) => ({
      file,
      index,
      preview: previewUrls[index],
    }))
    .filter((item) => Boolean(item.file && item.preview))
  const uploadedCount = uploadedImages.length
  const nextEmptyIndex = imageFiles.findIndex((file) => file == null)
  const canAddImage = nextEmptyIndex !== -1

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

        <div className="space-y-6">
          <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
            <div className="space-y-4 rounded-lg border bg-white px-4 py-4">
              <h2 className="text-lg font-semibold text-foreground">
                {tCreate("step3IdeaTitle")}
              </h2>
              <div className="space-y-2">
                <label
                  htmlFor="proposition-edit-title"
                  className="text-sm font-medium text-foreground"
                >
                  {tCreate("step3TitleLabel")}
                </label>
                <Input
                  id="proposition-edit-title"
                  name="title"
                  value={title}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setTitle(e.target.value)
                  }
                  placeholder={tCreate("step3TitlePlaceholder")}
                  className="h-11"
                />
              </div>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder={tCreate("step3DescriptionPlaceholder")}
              />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {canAddImage ? (
                    <label className="focus-ring inline-flex h-16 w-16 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-input bg-muted/30 p-1 text-[10px] leading-tight text-muted-foreground transition-colors hover:bg-muted/50">
                      <input
                        id={`proposition-edit-image-${nextEmptyIndex + 1}`}
                        name={`image-${nextEmptyIndex + 1}`}
                        type="file"
                        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                        className="sr-only"
                        onChange={(e) => handleImageChange(nextEmptyIndex, e)}
                      />
                      <ImageIcon className="size-4 shrink-0" />
                      <span className="text-center">
                        {tCreate("addImageButton")}
                      </span>
                    </label>
                  ) : (
                    <div className="inline-flex min-h-[44px] items-center rounded-md border border-input bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      5/5
                    </div>
                  )}
                  {(existingImages.length > 0 || uploadedCount > 0) && (
                    <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
                      {existingImages.map((item, index) => (
                        <div
                          key={`existing-image-${item.url}-${index}`}
                          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-input bg-muted/30"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.url}
                            alt={item.caption ?? `Image ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleExistingImageRemove(index)}
                            className="focus-ring absolute right-0.5 top-0.5 rounded-full bg-background/85 p-0.5 text-muted-foreground shadow-sm hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
                            aria-label={t("removeImageAria")}
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                      {uploadedImages.map((item) => (
                        <div
                          key={`uploaded-image-${item.index}`}
                          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-input bg-muted/30"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.preview!}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleImageRemove(item.index)}
                            className="focus-ring absolute right-0.5 top-0.5 rounded-full bg-background/85 p-0.5 text-muted-foreground shadow-sm hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
                            aria-label={t("removeImageAria")}
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  <p>{tCreate("step3ImagesHint")}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border bg-white px-4 py-4">
              <h2 className="text-lg font-semibold text-foreground">
                {tCreate("step3PageTitle")}
              </h2>
              <p className="text-sm font-normal text-foreground">
                {tCreate("step3PageDescription")}
              </p>
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
                  <SelectValue placeholder={tCreate("step3PagePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tCreate("step3PageNone")}</SelectItem>
                  <SelectItem value="existing">{tCreate("step3PageExisting")}</SelectItem>
                </SelectContent>
              </Select>
              {linkChoice === "existing" && (
                <div className="space-y-2">
                  <label
                    htmlFor="proposition-edit-page-search"
                    className="text-sm font-medium text-foreground"
                  >
                    {tCreate("step3PageSearchLabel")}
                  </label>
                  <Input
                    id="proposition-edit-page-search"
                    name="pageSearch"
                    value={pageQuery}
                    onChange={(e) => {
                      setPageQuery(e.target.value)
                      setSelectedPage(null)
                    }}
                    placeholder={tCreate("step3PageSearchPlaceholder")}
                    className="h-11"
                  />
                  {pageLoading && (
                    <p className="text-sm text-muted-foreground">
                      {tCreate("step3PageSearching")}
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
                        {tCreate("step3PageNotFound")}
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
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1">
                        <Alert
                          variant="success"
                          title={tCreate("step3PageSelected", { name: selectedPage.name })}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPage(null)
                            setPageQuery("")
                            setPageResults([])
                            setPageError(null)
                            setPageLoading(false)
                          }}
                          className="absolute right-2 top-2 rounded-md p-1 text-emerald-900/70 transition hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-100/70 dark:hover:bg-emerald-950/60"
                          aria-label={tCommon("remove")}
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-lg border bg-white px-4 py-4">
              <h2 className="text-lg font-semibold text-foreground">
                {tCreate("step3CategoryTitle")}
              </h2>
              <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                <PopoverAnchor asChild>
                  <div className="space-y-2">
                    <label
                      htmlFor="proposition-edit-category"
                      className="text-sm font-medium text-foreground"
                    >
                      {tCreate("step3CategoryLabel")}
                    </label>
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
                      placeholder={tCreate("step3CategoryPlaceholder")}
                      className="h-11"
                    />
                  </div>
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
                        {tCreate("step3CategoryEmpty")}
                      </p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-4 rounded-lg border bg-white px-4 py-4">
              <h2 className="text-lg font-semibold text-foreground">
                {tCreate("step3NotificationsTitle")}
              </h2>
              <div className="space-y-2 text-sm font-normal">
                <NotificationToggle
                  id="proposition-edit-notify-comments"
                  label={t("notifyComments")}
                  checked={notifyComments}
                  onCheckedChange={setNotifyComments}
                />
                <NotificationToggle
                  id="proposition-edit-notify-volunteers"
                  label={t("notifyVolunteers")}
                  checked={notifyVolunteers}
                  onCheckedChange={setNotifyVolunteers}
                />
                <NotificationToggle
                  id="proposition-edit-notify-solutions"
                  label={t("notifySolutions")}
                  checked={notifySolutions}
                  onCheckedChange={setNotifySolutions}
                />
              </div>
            </div>
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
        </div>
      </div>
    </div>
  )
}