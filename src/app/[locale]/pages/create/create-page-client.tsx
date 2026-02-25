"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Alert } from "@/components/ui/alert"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { usePageSearch, type PageResult } from "@/hooks/use-page-search"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"
import { useToast } from "@/components/ui/toast"

const CREATE_PAGE_DRAFT_STORAGE_KEY = "forom:create-page:draft"

export function CreatePageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations("PageCreate")
  const tVerification = useTranslations("PageVerification")
  const tCommon = useTranslations("Common")
  const locale = useLocale()
  const tCategories = useTranslations("Categories")
  const { showToast } = useToast()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [categoryQuery, setCategoryQuery] = useState("")
  const [isRepresentative, setIsRepresentative] = useState(false)
  const [verificationMethod, setVerificationMethod] = useState("email")
  const [verificationProof, setVerificationProof] = useState("")
  const [verificationNote, setVerificationNote] = useState("")
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [parentQueryInput, setParentQueryInput] = useState("")
  const [parentOpen, setParentOpen] = useState(false)
  const parentAnchorRef = useRef<HTMLInputElement | null>(null)
  const [parentPopoverWidth, setParentPopoverWidth] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [draftHydrated, setDraftHydrated] = useState(false)
  const {
    query: parentQuery,
    setQuery: setParentQuery,
    results: parentResults,
    loading: parentLoading,
    error: parentError,
    selectedPage: selectedParent,
    setSelectedPage: setSelectedParent,
    touched: parentTouched,
    clearResults: clearParentResults,
  } = usePageSearch({
    enabled: parentOpen,
  })
  useEffect(() => {
    if (!parentOpen) return
    const width = parentAnchorRef.current?.offsetWidth ?? null
    setParentPopoverWidth(width)
  }, [parentOpen, parentQueryInput])


  const categoryGroups = [
    {
      label: tCategories("groupTerritory"),
      items: [
        { value: "country", label: tCategories("country") },
        { value: "region", label: tCategories("region") },
        { value: "city", label: tCategories("city") },
        { value: "district", label: tCategories("district") },
        { value: "supranational", label: tCategories("supranational") },
      ],
    },
    {
      label: tCategories("groupOrganization"),
      items: [
        { value: "company", label: tCategories("company") },
        { value: "brand", label: tCategories("brand") },
        { value: "institution", label: tCategories("institution") },
        { value: "association", label: tCategories("association") },
        { value: "school", label: tCategories("school") },
      ],
    },
    {
      label: tCategories("groupProductService"),
      items: [
        { value: "product", label: tCategories("product") },
        { value: "service", label: tCategories("service") },
        { value: "app", label: tCategories("app") },
        { value: "website", label: tCategories("website") },
        { value: "platform", label: tCategories("platform") },
      ],
    },
    {
      label: tCategories("groupPlaceEvent"),
      items: [
        { value: "place", label: tCategories("place") },
        { value: "venue", label: tCategories("venue") },
        { value: "event", label: tCategories("event") },
      ],
    },
    {
      label: tCategories("groupMediaContent"),
      items: [
        { value: "media", label: tCategories("media") },
        { value: "community", label: tCategories("community") },
      ],
    },
    {
      label: tCategories("groupOther"),
      items: [{ value: "other", label: tCategories("other") }],
    },
  ]

  const selectedCategoryLabel =
    categoryGroups
      .flatMap((group) => group.items)
      .find((item) => item.value === category)?.label ?? ""

  useEffect(() => {
    if (!categoryQuery && selectedCategoryLabel) {
      setCategoryQuery(selectedCategoryLabel)
    }
  }, [categoryQuery, selectedCategoryLabel])

  const filteredCategoryGroups = categoryQuery.trim()
    ? categoryGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) =>
            item.label.toLowerCase().includes(categoryQuery.trim().toLowerCase())
          ),
        }))
        .filter((group) => group.items.length > 0)
    : categoryGroups

  const verificationMethods = [
    { value: "email", label: tVerification("methodEmail"), hint: tVerification("methodEmailHint") },
    { value: "dns", label: tVerification("methodDns"), hint: tVerification("methodDnsHint") },
    { value: "file", label: tVerification("methodFile"), hint: tVerification("methodFileHint") },
    { value: "social", label: tVerification("methodSocial"), hint: tVerification("methodSocialHint") },
  ]
  const selectedVerificationMethod = verificationMethods.find(
    (method) => method.value === verificationMethod
  )

  useEffect(() => {
    const nextName = searchParams.get("name")
    if (nextName && !name.trim()) {
      const timeout = setTimeout(() => {
        setName(nextName)
      }, 0)
      return () => clearTimeout(timeout)
    }
  }, [name, searchParams])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(CREATE_PAGE_DRAFT_STORAGE_KEY)
      if (!raw) {
        setDraftHydrated(true)
        return
      }
      const parsed = JSON.parse(raw) as
        | {
            name?: string
            description?: string
            category?: string
            categoryQuery?: string
            isRepresentative?: boolean
            verificationMethod?: string
            verificationProof?: string
            verificationNote?: string
            selectedParent?: PageResult | null
            parentQueryInput?: string
          }
        | null
      if (!parsed) {
        setDraftHydrated(true)
        return
      }
      if (typeof parsed.name === "string") setName(parsed.name)
      if (typeof parsed.description === "string") setDescription(parsed.description)
      if (typeof parsed.category === "string") setCategory(parsed.category)
      if (typeof parsed.categoryQuery === "string") setCategoryQuery(parsed.categoryQuery)
      if (typeof parsed.isRepresentative === "boolean") setIsRepresentative(parsed.isRepresentative)
      if (typeof parsed.verificationMethod === "string") {
        setVerificationMethod(parsed.verificationMethod)
      }
      if (typeof parsed.verificationProof === "string") setVerificationProof(parsed.verificationProof)
      if (typeof parsed.verificationNote === "string") setVerificationNote(parsed.verificationNote)
      if (parsed.selectedParent?.id && parsed.selectedParent?.name && parsed.selectedParent?.slug) {
        setSelectedParent(parsed.selectedParent)
        setParentQuery(parsed.selectedParent.name, { keepSelection: true, touched: false })
      }
      if (typeof parsed.parentQueryInput === "string") setParentQueryInput(parsed.parentQueryInput)
    } catch {
      // Ignore malformed draft payloads.
    } finally {
      setDraftHydrated(true)
    }
  }, [setParentQuery, setSelectedParent])

  useEffect(() => {
    if (!draftHydrated) return
    if (typeof window === "undefined") return
    try {
      const payload = {
        name,
        description,
        category,
        categoryQuery,
        isRepresentative,
        verificationMethod,
        verificationProof,
        verificationNote,
        selectedParent,
        parentQueryInput,
      }
      window.localStorage.setItem(CREATE_PAGE_DRAFT_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Ignore storage write failures.
    }
  }, [
    draftHydrated,
    name,
    description,
    category,
    categoryQuery,
    isRepresentative,
    verificationMethod,
    verificationProof,
    verificationNote,
    selectedParent,
    parentQueryInput,
  ])

  const handleSelectParent = (page: PageResult) => {
    setSelectedParent(page)
    setParentQuery(page.name, { keepSelection: true, touched: false })
    setParentQueryInput(page.name)
    clearParentResults()
    setParentOpen(false)
  }

  const handleClearParent = () => {
    setSelectedParent(null)
    setParentQuery("", { touched: false })
    setParentQueryInput("")
    clearParentResults()
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t("nameRequired"))
      return
    }
    if (isRepresentative && !verificationProof.trim()) {
      setError(t("verificationProofRequired"))
      return
    }
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError(t("supabaseNotConfigured"))
      return
    }
    const trimmedName = name.trim()
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (!user) {
      router.push(`/${locale}/pages/create?auth=signup&next=${encodeURIComponent(`/${locale}/pages/create`)}`)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { data, error: insertError } = await supabase
        .from("pages")
        .insert({
          owner_id: user.id,
          name: trimmedName,
          description: description.trim() || null,
          category: category.trim() || null,
          certification_type: "NONE",
          is_verified: false,
        })
        .select("id, slug")
        .single()

      if (insertError || !data) {
        const message =
          insertError?.code === "23505" ||
          insertError?.message?.includes("pages_slug_unique")
            ? t("duplicatePageError")
            : insertError?.message ?? t("createPageError")
        setError(message)
        return
      }

      if (selectedParent?.id) {
        const { error: parentError } = await supabase
          .from("page_parent_requests")
          .upsert(
            {
              child_page_id: data.id,
              parent_page_id: selectedParent.id,
              requested_by: user.id,
            },
            { onConflict: "child_page_id" }
          )
        if (parentError) {
          showToast({
            variant: "error",
            title: t("parentRequestError"),
            description: parentError.message,
          })
        } else {
          showToast({
            variant: "info",
            title: t("parentRequestSent"),
          })
          fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "page_parent_request",
              pageId: selectedParent.id,
              childPageId: data.id,
              actorUserId: user.id,
              locale,
            }),
          }).catch(() => null)
        }
      }

      if (isRepresentative) {
        const { error: verificationError } = await supabase
          .from("page_verification_requests")
          .insert({
            page_id: data.id,
            requested_by: user.id,
            method: verificationMethod,
            proof: verificationProof.trim(),
            requester_note: verificationNote.trim() || null,
          })

        if (verificationError) {
          setError(t("verificationRequestError"))
          return
        }
      }

      setSuccessMessage(
        t("createSuccess")
      )
      showToast({
        variant: "success",
        title: t("createSuccessTitle"),
        description: t("createSuccess"),
      })
      if (isRepresentative) {
        showToast({
          variant: "info",
          title: t("verificationRequestTitle"),
          description: t("verificationRequestSent"),
        })
      }
      if (data.slug) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(CREATE_PAGE_DRAFT_STORAGE_KEY)
        }
        router.push(`/pages/${data.slug}`)
      }
    } catch (err) {
      const fallbackMessage = t("createPageError")
      const message =
        err instanceof Error && err.message.trim() ? err.message : fallbackMessage
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16 pb-24 sm:pb-16">
      <div className="mx-auto w-full max-w-3xl space-y-3">
        <Link
          href="/"
          className="link-nav hidden w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground sm:inline-flex"
        >
          ← {tCommon("back")}
        </Link>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("parentHint")}</p>
        </div>
        <div className="space-y-4 px-6 py-2">
            <div className="space-y-2">
              <label htmlFor="page-name" className="text-sm font-medium text-foreground">
                {t("nameLabel")}
              </label>
            <Input
              id="page-name"
              name="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                if (error) setError(null)
                if (successMessage) setSuccessMessage(null)
              }}
              placeholder={t("namePlaceholder")}
              className="h-11"
            />
            </div>
            <div className="space-y-2">
              <label htmlFor="page-description" className="text-sm font-medium text-foreground">
                {t("descriptionLabel")}
              </label>
            <Textarea
              id="page-description"
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={3}
              className="min-h-[88px]"
            />
            </div>
            <div className="space-y-2">
              <label htmlFor="page-category" className="text-sm font-medium text-foreground">
                {t("categoryLabel")}
              </label>
            <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
              <PopoverAnchor asChild>
                <Input
                  id="page-category"
                  name="category"
                  value={categoryQuery}
                  onChange={(event) => {
                    const value = event.target.value
                    setCategoryQuery(value)
                    if (!value.trim()) {
                      setCategory("")
                    }
                    if (!categoryOpen) {
                      setCategoryOpen(true)
                    }
                  }}
                  onFocus={() => setCategoryOpen(true)}
                  placeholder={t("categoryPlaceholder")}
                  className="h-11"
                />
              </PopoverAnchor>
              <PopoverContent className="max-h-80 w-[var(--radix-popover-trigger-width)] overflow-y-auto p-0">
                <Command shouldFilter={false}>
                  {filteredCategoryGroups.map((group) => (
                    <CommandGroup key={group.label} heading={group.label}>
                      {group.items.map((item) => (
                        <CommandItem
                          key={item.value}
                          value={item.label}
                          onSelect={() => {
                            setCategory(item.value)
                            setCategoryQuery(item.label)
                            setCategoryOpen(false)
                          }}
                        >
                          {item.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                  {filteredCategoryGroups.length === 0 && (
                    <CommandItem disabled>{t("categoryEmpty")}</CommandItem>
                  )}
                </Command>
              </PopoverContent>
            </Popover>
            </div>
            <div className="space-y-2">
              <label htmlFor="page-parent-query" className="text-sm font-medium text-foreground">
                {t("parentLabel")}
              </label>
              <Popover open={parentOpen} onOpenChange={setParentOpen}>
                <PopoverAnchor asChild>
                  <Input
                    id="page-parent-query"
                    name="parentPage"
                    ref={parentAnchorRef}
                    value={parentQueryInput}
                    onChange={(event) => {
                      const value = event.target.value
                      setParentQueryInput(value)
                      setParentQuery(value)
                      if (!value.trim()) {
                        setSelectedParent(null)
                      }
                      setParentOpen(Boolean(value.trim()))
                    }}
                    onFocus={() => setParentOpen(Boolean(parentQueryInput.trim()))}
                    placeholder={t("parentPlaceholder")}
                    className="h-11"
                  />
                </PopoverAnchor>
                {parentQueryInput.trim() !== "" && (
                  <PopoverContent
                    align="start"
                    className="p-1"
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    onCloseAutoFocus={(event) => event.preventDefault()}
                    style={
                      parentPopoverWidth ? { width: parentPopoverWidth } : undefined
                    }
                  >
                    {parentLoading && (
                      <p className="px-2 py-2 text-xs text-muted-foreground">
                        {tCommon("loading")}
                      </p>
                    )}
                    {!parentLoading &&
                      parentResults.map((page) => (
                        <button
                          key={page.id}
                          type="button"
                          onClick={() => handleSelectParent(page)}
                          className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        >
                          {page.name}
                        </button>
                      ))}
                    {!parentLoading &&
                      parentTouched &&
                      parentResults.length === 0 &&
                      !parentError && (
                        <p className="px-2 py-2 text-xs text-muted-foreground">
                          {t("parentNoResults")}
                        </p>
                      )}
                    {parentError && (
                      <p className="px-2 py-2 text-xs text-destructive">
                        {parentError}
                      </p>
                    )}
                  </PopoverContent>
                )}
              </Popover>
              <p className="text-xs text-muted-foreground">{t("parentHint")}</p>
              {selectedParent && (
                <Alert variant="success" className="relative items-center pr-9">
                  <div className="space-y-0.5">
                    <span className="text-sm">
                      {t("parentSelected", { name: selectedParent.name })}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {t("parentApprovalNotice", { name: selectedParent.name })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 h-6 w-6 text-emerald-900/70 hover:text-emerald-900 dark:text-emerald-100/70 dark:hover:text-emerald-100"
                    onClick={handleClearParent}
                    aria-label={tCommon("remove")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </Alert>
              )}
            </div>
            <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4 text-sm">
              <p className="font-medium text-foreground">{t("representativeTitle")}</p>
              <p className="text-muted-foreground">{t("representativeDescription")}</p>
              <label className="flex items-center gap-2 text-muted-foreground">
                <input
                  id="page-is-representative"
                  name="isRepresentative"
                  type="checkbox"
                  checked={isRepresentative}
                  onChange={(event) => {
                    setIsRepresentative(event.target.checked)
                    if (error) setError(null)
                  }}
                />
                <span>{t("representativeLabel")}</span>
              </label>
              {isRepresentative && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {tVerification("methodLabel")}
                    </label>
                    <select
                      id="page-verification-method"
                      name="verificationMethod"
                      value={verificationMethod}
                      onChange={(event) => setVerificationMethod(event.target.value)}
                      className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                      disabled={loading}
                    >
                      {verificationMethods.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                    {selectedVerificationMethod?.hint && (
                      <p className="text-xs text-muted-foreground">
                        {selectedVerificationMethod.hint}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {tVerification("proofLabel")}
                    </label>
                    <input
                      id="page-verification-proof"
                      name="verificationProof"
                      value={verificationProof}
                      onChange={(event) => setVerificationProof(event.target.value)}
                      placeholder={tVerification("proofPlaceholder")}
                      className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {tVerification("noteLabel")}
                    </label>
                    <textarea
                      id="page-verification-note"
                      name="verificationNote"
                      value={verificationNote}
                      onChange={(event) => setVerificationNote(event.target.value)}
                      placeholder={tVerification("notePlaceholder")}
                      className="min-h-[80px] w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                      disabled={loading}
                    />
                  </div>
                </div>
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {successMessage && (
              <p className="text-sm text-muted-foreground">{successMessage}</p>
            )}
            <div className="hidden flex-col items-stretch gap-3 sm:flex sm:flex-row sm:justify-end">
              <Button
                onClick={handleSubmit}
                disabled={loading || !name.trim()}
              >
                {loading ? tCommon("saving") : t("createButton")}
              </Button>
            </div>
          </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="min-h-[44px] flex-1"
          >
            {tCommon("back")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="min-h-[44px] flex-[1.4]"
          >
            {loading ? tCommon("saving") : t("createButton")}
          </Button>
        </div>
      </div>
    </div>
  )
}