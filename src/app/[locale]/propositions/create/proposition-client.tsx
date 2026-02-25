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
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { ImageIcon, X } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { ChevronDown, ChevronRight } from "lucide-react"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover"
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
import { resolveAuthUser } from "@/utils/supabase/auth-check"
import { usePageSearch, type PageResult } from "@/hooks/use-page-search"
import {
  sanitizeQuery,
  stripHtml,
  isDuplicatePropositionError,
  canSubmitProposition,
} from "@/lib/proposition-submission"

const CREATE_PROPOSITION_DRAFT_STORAGE_KEY = "forom:create-proposition:draft"

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
  onClearPage: () => void
  submitError: string | null
  submitLoading: boolean
  onReturnHome: () => void
  onSubmit: () => void
  canSubmit: boolean
  universe: Universe | null
  category: string
  subCategory: string
  categoryQuery: string
  categoryOpen: boolean
  onCategoryQueryChange: (value: string) => void
  onCategoryOpenChange: (open: boolean) => void
  onCategorySelect: (universe: Universe | null, category: string, subCategory: string) => void
}

const Step1Card = memo(function Step1Card({
  title,
  trimmedTitle,
  onTitleChange,
  onContinue,
}: Step1Props) {
  const t = useTranslations("PropositionCreate")
  const tCommon = useTranslations("Common")
  return (
    <div className="space-y-4 px-6 py-2">
        <div className="space-y-2">
          <label
            htmlFor="proposition-step1-title"
            className="text-sm font-medium text-foreground"
          >
            {t("step1FieldLabel")}
          </label>
          <Input
            id="proposition-step1-title"
            name="title"
            value={title}
            onChange={onTitleChange}
            onKeyDown={(event) => {
              if (event.key === "Enter" && trimmedTitle) {
                event.preventDefault()
                event.stopPropagation()
                onContinue()
              }
            }}
            placeholder={t("step1Placeholder")}
            className="h-11"
          />
        </div>
        <div className="hidden justify-end sm:flex">
          <Button size="lg" disabled={!trimmedTitle} onClick={onContinue}>
            {tCommon("continue")}
          </Button>
        </div>
    </div>
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
  const t = useTranslations("PropositionCreate")
  const tCommon = useTranslations("Common")
  return (
    <div
        className="space-y-4 px-6 py-2"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            event.stopPropagation()
            onContinue()
          }
        }}
      >
        {similarLoading && (
          <div className="space-y-3" role="status" aria-live="polite">
            <div className="grid gap-3">
              {[0, 1, 2].map((item) => (
                <div
                  key={`similar-skeleton-${item}`}
                  className="overflow-hidden rounded-lg border bg-background px-4 py-3"
                >
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-muted/80" />
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {t("step2Searching")}
            </p>
          </div>
        )}
        {!similarLoading && similarError && (
          <p className="text-sm text-destructive">{similarError}</p>
        )}
        {!similarLoading && !similarError && similarResults.length === 0 && (
          <Alert variant="success" title={t("step2NoDuplicateTitle")}>
            {t("step2NoDuplicateBody")}
          </Alert>
        )}
        <div className="grid gap-3">
          {similarResults.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border bg-background px-4 py-3"
            >
              <p className="font-medium text-foreground">{item.title}</p>
              <Button variant="outline" onClick={() => onSelectSimilar(item.id)}>
                {tCommon("view")}
              </Button>
            </div>
          ))}
        </div>
        <div className="hidden flex-col items-stretch gap-3 sm:flex sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={onBack} className="order-2 sm:order-1">
            {tCommon("back")}
          </Button>
          <Button size="lg" onClick={onContinue} className="order-1 sm:order-2">
            {tCommon("continue")}
          </Button>
        </div>
    </div>
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
  onClearPage,
  submitError,
  submitLoading,
  onReturnHome,
  onSubmit,
  canSubmit,
  universe,
  category,
  subCategory,
  categoryQuery,
  categoryOpen,
  onCategoryQueryChange,
  onCategoryOpenChange,
  onCategorySelect,
}: Step3Props) {
  const t = useTranslations("PropositionCreate")
  const tDiscover = useTranslations("Discover")
  const tCommon = useTranslations("Common")
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

  const selectUniverse = (u: Universe) => {
    onCategorySelect(u, "", "")
    onCategoryQueryChange(tDiscover(`universe_${u}`))
    onCategoryOpenChange(false)
  }
  const selectCategory = (u: Universe, c: string) => {
    onCategorySelect(u, c, "")
    onCategoryQueryChange(c)
    onCategoryOpenChange(false)
  }
  const selectSubCategory = (u: Universe, c: string, s: string) => {
    onCategorySelect(u, c, s)
    onCategoryQueryChange(s)
    onCategoryOpenChange(false)
  }

  const selectedLabel =
    subCategory || category || (universe ? tDiscover(`universe_${universe}`) : "")
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
  return (
    <div className="space-y-6 px-6 py-2">
        <div className="space-y-4 rounded-lg border bg-card px-4 py-4 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">
            {t("step3IdeaTitle")}
          </h2>
          <div className="space-y-2">
            <label
              htmlFor="proposition-step3-title"
              className="text-sm font-medium text-foreground"
            >
              {t("step3TitleLabel")}
            </label>
            <Input
              id="proposition-step3-title"
              name="title"
              value={title}
              onChange={onTitleChange}
              placeholder={t("step3TitlePlaceholder")}
              className="h-11"
            />
          </div>
          <RichTextEditor
            value={description}
            onChange={onDescriptionChange}
            placeholder={t("step3DescriptionPlaceholder")}
          />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {canAddImage ? (
                <label className="focus-ring inline-flex h-16 w-16 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-input bg-muted/30 p-1 text-[10px] leading-tight text-muted-foreground transition-colors hover:bg-muted/50">
                  <input
                    id={`proposition-image-${nextEmptyIndex + 1}`}
                    name={`image-${nextEmptyIndex + 1}`}
                    type="file"
                    accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                    className="sr-only"
                    onChange={(event) => onImageChange(nextEmptyIndex, event)}
                  />
                  <ImageIcon className="size-4 shrink-0" />
                  <span className="text-center">
                    {t("addImageButton")}
                  </span>
                </label>
              ) : (
                <div className="inline-flex min-h-[44px] items-center rounded-md border border-input bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  5/5
                </div>
              )}
              {uploadedCount > 0 && (
                <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
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
                        onClick={() => onImageRemove(item.index)}
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
              <p>{t("step3ImagesHint")}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border bg-muted/20 px-4 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {t("step3PageTitle")}
          </h2>
          <p className="text-sm font-normal text-foreground">
            {t("step3PageDescription")}
          </p>
          <Select value={linkChoice} onValueChange={onLinkChoiceChange}>
            <SelectTrigger>
              <SelectValue placeholder={t("step3PagePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("step3PageNone")}</SelectItem>
              <SelectItem value="existing">{t("step3PageExisting")}</SelectItem>
            </SelectContent>
          </Select>
          {linkChoice === "existing" && (
            <div className="space-y-2">
              <label
                htmlFor="proposition-page-search"
                className="text-sm font-medium text-foreground"
              >
                {t("step3PageSearchLabel")}
              </label>
              <Input
                id="proposition-page-search"
                name="pageSearch"
                value={pageQuery}
                onChange={(event) => onPageQueryChange(event.target.value)}
                placeholder={t("step3PageSearchPlaceholder")}
                className="h-11"
              />
              {pageLoading && (
                <p className="text-sm text-muted-foreground">
                  {t("step3PageSearching")}
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
                    {t("step3PageNotFound")}
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
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1">
                    <Alert
                      variant="success"
                      title={t("step3PageSelected", { name: selectedPage.name })}
                    />
                    <button
                      type="button"
                      onClick={onClearPage}
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

        <div className="space-y-4 rounded-lg border bg-muted/20 px-4 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {t("step3CategoryTitle")}
          </h2>
          <Popover open={categoryOpen} onOpenChange={onCategoryOpenChange}>
            <PopoverAnchor asChild>
              <div className="space-y-2">
                <label
                  htmlFor="proposition-category"
                  className="text-sm font-medium text-foreground"
                >
                  {t("step3CategoryLabel")}
                </label>
                <Input
                  id="proposition-category"
                  name="category"
                  value={categoryOpen ? categoryQuery : selectedLabel}
                  onChange={(e) => {
                    const value = e.target.value
                    onCategoryQueryChange(value)
                    if (!value.trim()) onCategorySelect(null, "", "")
                    if (!categoryOpen) onCategoryOpenChange(true)
                  }}
                  onFocus={() => onCategoryOpenChange(true)}
                  placeholder={t("step3CategoryPlaceholder")}
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
                      onClick={() => selectUniverse(uc.universe)}
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
                                aria-label={isExpanded ? "Replier" : "Déplier"}
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
                              onClick={() => selectCategory(uc.universe, cat.category)}
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
                                  onClick={() =>
                                    selectSubCategory(uc.universe, cat.category, sub)
                                  }
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
                    {t("step3CategoryEmpty")}
                  </p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-4 rounded-lg border bg-muted/20 px-4 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {t("step3NotificationsTitle")}
          </h2>
          <div className="space-y-2 text-sm font-normal">
            <p className="text-foreground">
              {t("step3NotificationsIntro")}
            </p>
            <label className="flex items-center gap-2">
              <input
                id="proposition-notify-comments"
                name="notifyComments"
                type="checkbox"
                checked={notifyComments}
                onChange={(event) => onNotifyCommentsChange(event.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              {t("notifyComments")}
            </label>
            <label className="flex items-center gap-2">
              <input
                id="proposition-notify-volunteers"
                name="notifyVolunteers"
                type="checkbox"
                checked={notifyVolunteers}
                onChange={(event) =>
                  onNotifyVolunteersChange(event.target.checked)
                }
                className="h-4 w-4 rounded border-border"
              />
              {t("notifyVolunteers")}
            </label>
            <label className="flex items-center gap-2">
              <input
                id="proposition-notify-solutions"
                name="notifySolutions"
                type="checkbox"
                checked={notifySolutions}
                onChange={(event) => onNotifySolutionsChange(event.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              {t("notifySolutions")}
            </label>
          </div>
        </div>

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}
        <div className="hidden flex-col items-stretch gap-3 sm:flex sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            onClick={onReturnHome}
            className="order-2 sm:order-1"
          >
            {tCommon("back")}
          </Button>
          <Button
            size="lg"
            onClick={onSubmit}
            className="order-1 sm:order-2"
            disabled={!canSubmit || submitLoading}
          >
            {submitLoading ? tCommon("submitting") : t("submitButton")}
          </Button>
        </div>
    </div>
  )
})

export default function CreatePropositionClient({
  initialTitle = "",
  initialPageSlug = "",
  initialPageName = "",
}: Props) {
  const t = useTranslations("PropositionCreate")
  const tCommon = useTranslations("Common")
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

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
  const [universe, setUniverse] = useState<Universe | null>(null)
  const [category, setCategory] = useState("")
  const [subCategory, setSubCategory] = useState("")
  const [categoryQuery, setCategoryQuery] = useState("")
  const [categoryOpen, setCategoryOpen] = useState(false)
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
  const [draftHydrated, setDraftHydrated] = useState(false)

  useEffect(() => {
    previewUrlsRef.current = previewUrls
    return () => {
      previewUrlsRef.current.forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
    }
  }, [previewUrls])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(CREATE_PROPOSITION_DRAFT_STORAGE_KEY)
      if (!raw) {
        setDraftHydrated(true)
        return
      }
      const parsed = JSON.parse(raw) as
        | {
            title?: string
            description?: string
            linkChoice?: string
            selectedPage?: PageResult | null
            notifyComments?: boolean
            notifyVolunteers?: boolean
            notifySolutions?: boolean
            universe?: Universe | null
            category?: string
            subCategory?: string
            step?: number
          }
        | null
      if (!parsed) {
        setDraftHydrated(true)
        return
      }
      if (typeof parsed.title === "string") setTitle(parsed.title)
      if (typeof parsed.description === "string") setDescription(parsed.description)
      if (parsed.linkChoice === "none" || parsed.linkChoice === "existing") {
        setLinkChoice(parsed.linkChoice)
      }
      if (parsed.selectedPage?.id && parsed.selectedPage?.name && parsed.selectedPage?.slug) {
        setSelectedPage(parsed.selectedPage)
        setPageQuery(parsed.selectedPage.name, { keepSelection: true, touched: false })
      }
      if (typeof parsed.notifyComments === "boolean") setNotifyComments(parsed.notifyComments)
      if (typeof parsed.notifyVolunteers === "boolean") setNotifyVolunteers(parsed.notifyVolunteers)
      if (typeof parsed.notifySolutions === "boolean") setNotifySolutions(parsed.notifySolutions)
      if (parsed.universe && Object.keys(UNIVERSE_SLUGS).includes(parsed.universe)) {
        setUniverse(parsed.universe as Universe)
      }
      if (typeof parsed.category === "string") setCategory(parsed.category)
      if (typeof parsed.subCategory === "string") setSubCategory(parsed.subCategory)
      if (parsed.step === 1 || parsed.step === 2 || parsed.step === 3) {
        setStep(parsed.step)
      }
    } catch {
      // Ignore malformed draft payloads.
    } finally {
      setDraftHydrated(true)
    }
  }, [setPageQuery, setSelectedPage])

  useEffect(() => {
    if (!draftHydrated) return
    if (typeof window === "undefined") return
    try {
      const payload = {
        title,
        description,
        linkChoice,
        selectedPage,
        notifyComments,
        notifyVolunteers,
        notifySolutions,
        universe,
        category,
        subCategory,
        step,
      }
      window.localStorage.setItem(CREATE_PROPOSITION_DRAFT_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Ignore storage write failures.
    }
  }, [
    draftHydrated,
    title,
    description,
    linkChoice,
    selectedPage,
    notifyComments,
    notifyVolunteers,
    notifySolutions,
    universe,
    category,
    subCategory,
    step,
  ])

  const trimmedTitle = useMemo(() => title.trim(), [title])
  const stepMeta = useMemo(() => {
    if (step === 1) {
      return {
        title: t("step1Title"),
        description: t("step1Description"),
      }
    }
    if (step === 2) {
      return {
        title: t("step2Title"),
        description: t("step2Description"),
      }
    }
    return {
      title: t("step3Title"),
      description: t("step3Overview"),
    }
  }, [step, t])

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
      setPageQuery(page.name, { keepSelection: true, touched: false })
      clearPageResults()
    },
    [clearPageResults, setPageQuery, setSelectedPage]
  )

  const handleClearPage = useCallback(() => {
    setSelectedPage(null)
    setPageQuery("", { touched: false })
    clearPageResults()
  }, [clearPageResults, setPageQuery, setSelectedPage])

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

  const canSubmit = canSubmitProposition(
    trimmedTitle,
    linkChoice as "none" | "existing" | "create",
    Boolean(selectedPage)
  )

  useEffect(() => {
    if (step !== 2 || !trimmedTitle) return

    const handle = setTimeout(async () => {
      const supabase = getSupabaseClient()
      if (!supabase) {
        setSimilarError(t("supabaseNotConfigured"))
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
  }, [step, t, trimmedTitle])

  // page search handled by usePageSearch hook

  const handleSubmit = useCallback(async () => {
    if (!trimmedTitle) return
    if (linkChoice === "existing" && !selectedPage) {
      setSubmitError(t("selectExistingPageError"))
      return
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      setSubmitError(t("supabaseNotConfigured"))
      return
    }

    setSubmitLoading(true)
    setSubmitError(null)
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (!user) {
      const currentPath = `${pathname || `/${locale}`}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.set("auth", "signup")
      nextParams.set("next", currentPath)
      router.replace(`${pathname || `/${locale}`}?${nextParams.toString()}`)
      setSubmitLoading(false)
      return
    }

    const imageUrls: { url: string; caption?: string }[] = []
    const hasImages = imageFiles.some(Boolean)
    if (hasImages) {
      const ensureRes = await fetch(`/api/ensure-storage-bucket?locale=${locale}`, {
        method: "POST",
      })
      if (!ensureRes.ok) {
        const body = await ensureRes.json().catch(() => ({}))
        setSubmitError(
          body?.error ??
            t("imageStorageError")
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
            ? t("imageBucketMissing")
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

    const descriptionText = stripHtml(description ?? "")
    const { data, error } = await supabase
      .from("propositions")
      .insert({
        author_id: user.id,
        title: trimmedTitle,
        description: descriptionText ? description : null,
        status: "Open",
        page_id: selectedPage?.id ?? null,
        universe: universe ?? null,
        category: category || null,
        sub_category: subCategory || null,
        notify_comments: notifyComments,
        notify_volunteers: notifyVolunteers,
        notify_solutions: notifySolutions,
        image_urls: imageUrls,
      })
      .select("id")
      .single()

    if (error || !data) {
      setSubmitError(
        isDuplicatePropositionError(error ?? null)
          ? t("duplicatePropositionError")
          : (error?.message ?? t("createPropositionError"))
      )
      setSubmitLoading(false)
      return
    }

    router.push(`/propositions/${data.id}`)
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CREATE_PROPOSITION_DRAFT_STORAGE_KEY)
    }
  }, [
    category,
    description,
    imageFiles,
    linkChoice,
    locale,
    notifyComments,
    notifySolutions,
    notifyVolunteers,
    pathname,
    router,
    searchParams,
    selectedPage,
    subCategory,
    t,
    trimmedTitle,
    universe,
  ])

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16 pb-24 sm:pb-16">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="space-y-2">
          <Link
            href="/"
            className="link-nav hidden w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground sm:inline-flex"
          >
          ← {tCommon("back")}
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {t("pageTitle")}
          </h1>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((index) => (
              <div
                key={index}
                className={
                  index <= step
                    ? "h-1.5 rounded-full bg-primary"
                    : "h-1.5 rounded-full bg-muted"
                }
              />
            ))}
          </div>
          <p className="text-sm font-semibold text-foreground">{stepMeta.title}</p>
          <p className="text-sm text-muted-foreground">{stepMeta.description}</p>
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
            onClearPage={handleClearPage}
            submitError={submitError}
            submitLoading={submitLoading}
            onReturnHome={handleReturnHome}
            onSubmit={handleSubmit}
            canSubmit={Boolean(canSubmit)}
            universe={universe}
            category={category}
            subCategory={subCategory}
            categoryQuery={categoryQuery}
            categoryOpen={categoryOpen}
            onCategoryQueryChange={setCategoryQuery}
            onCategoryOpenChange={setCategoryOpen}
            onCategorySelect={(u, c, s) => {
              setUniverse(u)
              setCategory(c)
              setSubCategory(s)
            }}
          />
        )}
      </div>
      {step === 1 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
            <Button
              variant="ghost"
              onClick={handleReturnHome}
              className="min-h-[44px] flex-1"
            >
              {tCommon("back")}
            </Button>
            <Button
              onClick={() => goToStep(2)}
              className="min-h-[44px] flex-[1.4]"
              disabled={!trimmedTitle}
            >
              {tCommon("continue")}
            </Button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => goToStep(1)}
              className="min-h-[44px] flex-1"
            >
              {tCommon("back")}
            </Button>
            <Button
              onClick={() => goToStep(3)}
              className="min-h-[44px] flex-[1.4]"
            >
              {tCommon("continue")}
            </Button>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
            <Button
              variant="ghost"
              onClick={handleReturnHome}
              className="min-h-[44px] flex-1"
            >
              {tCommon("back")}
            </Button>
            <Button
              onClick={handleSubmit}
              className="min-h-[44px] flex-[1.4]"
              disabled={!canSubmit || submitLoading}
            >
              {submitLoading ? tCommon("submitting") : t("submitButton")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}