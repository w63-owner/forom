"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import debounce from "lodash/debounce"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/components/ui/toast"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { getSupabaseClient } from "@/utils/supabase/client"
import {
  AsyncTimeoutError,
  fetchWithTimeout,
  withRetry,
} from "@/lib/async-resilience"
import { resolveAuthUser } from "@/utils/supabase/auth-check"
import { FileText, Lightbulb, Plus } from "lucide-react"

type PropositionResult = {
  id: string
  title: string
  status: string | null
  votes_count: number | null
  pages?: { name: string | null } | { name: string | null }[] | null
}

type PageResult = {
  id: string
  name: string
  slug: string | null
  is_verified: boolean | null
  certification_type: string | null
}

export function Omnibar() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("Omnibar")
  const tCommon = useTranslations("Common")
  const { showToast } = useToast()
  const requestId = useRef(0)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PropositionResult[]>([])
  const [pageResults, setPageResults] = useState<PageResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createPopoverOpen, setCreatePopoverOpen] = useState(false)

  const placeholderSamples = useMemo(() => {
    const raw = t.raw("placeholderSamples")
    return Array.isArray(raw) ? raw : []
  }, [t])
  const randomPlaceholder = placeholderSamples[0] ?? t("placeholderFallback")

  const trimmedQuery = useMemo(() => query.trim(), [query])

  const debouncedSearchRef = useRef<ReturnType<typeof debounce> | null>(null)

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    void resolveAuthUser(supabase, {
      timeoutMs: 1500,
      includeServerFallback: false,
    })
  }, [])

  const goToCreateProposition = async (href: string) => {
    setCreatePopoverOpen(false)
    if (!(await requireAuth())) return
    router.push(href)
  }

  const goToCreatePage = async (href: string) => {
    setCreatePopoverOpen(false)
    if (!(await requireAuth())) return
    router.push(href)
  }

  const requireAuth = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      showToast({
        variant: "error",
        title: t("supabaseNotConfigured"),
      })
      return false
    }
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 4000,
      includeServerFallback: true,
    })
    if (user) {
      return true
    }
    showToast({
      variant: "info",
      title: tCommon("loginRequiredTitle"),
      description: tCommon("loginRequiredBody"),
    })
    return false
  }

  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (!value.trim()) {
      requestId.current += 1
      setResults([])
      setPageResults([])
      setError(null)
      setLoading(false)
    }
  }

  useEffect(() => {
    debouncedSearchRef.current = debounce(async (value: string) => {
      const currentRequest = (requestId.current += 1)
      setLoading(true)
      setError(null)
      const SEARCH_TIMEOUT_MS = 15_000
      try {
        const res = await withRetry(
          () =>
            fetchWithTimeout(
              `/api/omnibar/search?q=${encodeURIComponent(value.trim())}&locale=${locale}`,
              {},
              SEARCH_TIMEOUT_MS
            ),
          {
            attempts: 2,
            delayMs: 200,
            shouldRetry: (error) => !(error instanceof AsyncTimeoutError),
          }
        )
        const data = (await res.json()) as {
          propositions?: PropositionResult[]
          pages?: PageResult[]
          error?: string
        }

        if (currentRequest !== requestId.current) return

        if (!res.ok || data.error) {
          const errMsg = data.error ?? t("searchError")
          setError(errMsg)
          setResults([])
          setPageResults([])
          showToast({ variant: "error", title: t("searchFailedToast") })
          setLoading(false)
          return
        }
        const unique = new Map<string, PropositionResult>()
        for (const item of data.propositions ?? []) {
          unique.set(item.id, item)
        }
        setResults(Array.from(unique.values()))
        setPageResults(data.pages ?? [])
      } catch (err) {
        if (currentRequest !== requestId.current) return
        const errMsg =
          err instanceof AsyncTimeoutError
            ? t("actionTimeoutToast")
            : err instanceof Error
              ? err.message
              : t("searchError")
        setError(errMsg)
        setResults([])
        setPageResults([])
        showToast({ variant: "error", title: t("searchFailedToast") })
      } finally {
        if (currentRequest !== requestId.current) return
        setLoading(false)
      }
    }, 300)

    return () => debouncedSearchRef.current?.cancel()
  }, [locale, t, showToast])

  useEffect(() => {
    if (!trimmedQuery) return
    debouncedSearchRef.current?.(trimmedQuery)
    return () => debouncedSearchRef.current?.cancel()
  }, [trimmedQuery])

  return (
    <div className="w-full max-w-2xl">
      <Command
        shouldFilter={false}
        className="rounded-2xl border border-border bg-background shadow-lg transition-shadow focus-within:border-ring/50 focus-within:ring-2 focus-within:ring-ring/20"
      >
        <div className="flex min-h-[52px] items-center gap-2 px-4 py-2.5">
          <CommandInput
            value={query}
            onValueChange={handleQueryChange}
            placeholder={randomPlaceholder}
            className="h-11 min-w-0 flex-1 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
          />
          <Popover open={createPopoverOpen} onOpenChange={setCreatePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                aria-label={t("createAriaLabel")}
              >
                <Plus className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1">
              <Link
                href={
                  trimmedQuery
                    ? `/${locale}/propositions/create?title=${encodeURIComponent(trimmedQuery)}`
                    : `/${locale}/propositions/create`
                }
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
                onClick={(e) => {
                  e.preventDefault()
                  const href =
                    e.currentTarget.getAttribute("href") ??
                    `/${locale}/propositions/create`
                  void goToCreateProposition(href)
                }}
              >
                <Lightbulb className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {t("addProposition")}
              </Link>
              <Link
                href={
                  trimmedQuery
                    ? `/${locale}/pages/create?name=${encodeURIComponent(trimmedQuery)}`
                    : `/${locale}/pages/create`
                }
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
                onClick={(e) => {
                  e.preventDefault()
                  const href =
                    e.currentTarget.getAttribute("href") ??
                    `/${locale}/pages/create`
                  void goToCreatePage(href)
                }}
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {t("createPage")}
              </Link>
            </PopoverContent>
          </Popover>
        </div>
        <CommandList className="pb-3 pl-9 pr-3">
          {loading && (
            <CommandItem disabled className="text-sm text-muted-foreground">
              {t("searching")}
            </CommandItem>
          )}
          {!loading && error && (
            <CommandItem disabled className="text-sm text-destructive">
              {error}
            </CommandItem>
          )}
          {!loading &&
            !error &&
            trimmedQuery &&
            results.length === 0 &&
            pageResults.length === 0 && (
            <CommandItem disabled className="px-0 text-sm text-muted-foreground">
              {t("noResults")}
            </CommandItem>
          )}
          {pageResults.length > 0 && (
            <CommandGroup className="p-0">
              {pageResults.map((page) => {
                const isVerified =
                  Boolean(page.is_verified) ||
                  page.certification_type === "OFFICIAL"
                return (
                <CommandItem
                  key={page.id}
                  value={`page-${page.id}`}
                  className="px-0"
                  onSelect={() => {
                    if (!page.slug) return
                    router.push(`/${locale}/pages/${page.slug}`)
                  }}
                >
                  <div className="flex w-full items-center justify-start gap-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{page.name}</span>
                    {isVerified && (
                      <span
                        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[8px] font-semibold text-white"
                        aria-label={t("verifiedBadge")}
                        title={t("verifiedBadge")}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                </CommandItem>
              )
              })}
            </CommandGroup>
          )}
          {results.length > 0 && (
            <CommandGroup className="p-0">
              {results.map((item) => {
                const pageName = Array.isArray(item.pages)
                  ? item.pages[0]?.name
                  : item.pages?.name
                return (
                  <CommandItem
                    key={item.id}
                    value={item.title}
                    className="px-0"
                    onSelect={() => router.push(`/${locale}/propositions/${item.id}`)}
                  >
                    <div className="flex w-full items-center justify-between gap-2 text-left">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Lightbulb className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate font-normal text-foreground">
                          {item.title}
                        </span>
                      </div>
                      {pageName && (
                        <Badge variant="outline" className="shrink-0 capitalize">
                          {pageName}
                        </Badge>
                      )}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}
          {query.length > 0 && (
            <CommandItem
              value={`create-${query}`}
              disabled={!trimmedQuery}
              className="px-0"
              onSelect={() => {
                if (!trimmedQuery) return
                void (async () => {
                  await goToCreateProposition(
                    `/${locale}/propositions/create?title=${encodeURIComponent(trimmedQuery)}`
                  )
                })()
              }}
              onClick={() => {
                if (!trimmedQuery) return
                void goToCreateProposition(
                  `/${locale}/propositions/create?title=${encodeURIComponent(trimmedQuery)}`
                )
              }}
            >
              <div className="flex w-full items-center justify-between gap-4">
                <span className="truncate font-medium text-foreground">
                  {query}
                </span>
                <Badge variant="outline">{t("addPropositionBadge")}</Badge>
              </div>
            </CommandItem>
          )}
          {query.length > 0 && (
            <CommandItem
              value={`create-page-${query}`}
              disabled={!trimmedQuery}
              className="px-0"
              onSelect={() => {
                if (!trimmedQuery) return
                void (async () => {
                  await goToCreatePage(
                    `/${locale}/pages/create?name=${encodeURIComponent(trimmedQuery)}`
                  )
                })()
              }}
              onClick={() => {
                if (!trimmedQuery) return
                void goToCreatePage(
                  `/${locale}/pages/create?name=${encodeURIComponent(trimmedQuery)}`
                )
              }}
            >
              <div className="flex w-full items-center justify-between gap-4">
                <span className="truncate font-medium text-foreground">
                  {query}
                </span>
                <Badge variant="outline">{t("createPageBadge")}</Badge>
              </div>
            </CommandItem>
          )}
        </CommandList>
      </Command>
    </div>
  )
}