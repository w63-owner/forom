"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Search } from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { getSupabaseClient } from "@/utils/supabase/client"
import { isAbortLikeError } from "@/lib/async-resilience"

type PropositionResult = {
  id: string
  title: string
  votes_count: number | null
}

const sanitizeQuery = (value: string) => value.replace(/[%_]/g, "\\$&")

export function OmniSearch() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("OmniSearch")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PropositionResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedQuery = useMemo(() => query.trim(), [query])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (!value.trim()) {
      setResults([])
      setError(null)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!trimmedQuery) return

    let isActive = true
    const handle = setTimeout(async () => {
      const supabase = getSupabaseClient()
      if (!supabase) {
        if (!isActive) return
        setError(t("supabaseNotConfigured"))
        setResults([])
        return
      }

      if (!isActive) return
      setLoading(true)
      setError(null)
      try {
        const safeQuery = sanitizeQuery(trimmedQuery)
        const { data, error: queryError } = await supabase
          .from("propositions")
          .select("id, title, votes_count")
          .or(`title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`)
          .order("votes_count", { ascending: false })
          .limit(8)

        if (!isActive) return
        if (queryError) {
          setError(queryError.message)
          setResults([])
        } else {
          setResults(data ?? [])
        }
      } catch (err) {
        if (!isActive || isAbortLikeError(err)) return
        setError(err instanceof Error ? err.message : "Search failed")
        setResults([])
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }, 300)

    return () => {
      isActive = false
      clearTimeout(handle)
    }
  }, [trimmedQuery, t])

  const createLabel = trimmedQuery
    ? t("createWithTitle", { title: trimmedQuery })
    : t("createFallback")

  return (
    <div id="omnibox" className="w-full max-w-2xl">
      <Command className="relative overflow-visible rounded-2xl border border-border bg-background shadow-xl">
        <div className="flex items-center gap-3 px-4 py-4">
          <Search className="h-5 w-5 text-muted-foreground" />
          <CommandInput
            value={query}
            onValueChange={handleQueryChange}
            placeholder={t("placeholder")}
            className="h-12 text-base"
          />
        </div>
        <CommandList className="absolute left-0 right-0 top-full z-10 rounded-b-2xl border border-border border-t-0 bg-background shadow-xl">
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
          <CommandEmpty>
            {trimmedQuery ? t("noResults") : t("startTyping")}
          </CommandEmpty>
          {results.length > 0 && (
            <CommandGroup heading={t("similarHeading")}>
              {results.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.title}
                  onSelect={() => router.push(`/propositions/${item.id}`)}
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="truncate">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("votesLabel", { count: item.votes_count ?? 0 })}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading={t("createHeading")}>
            <CommandItem
              value={`create-${trimmedQuery}`}
              onSelect={() =>
                router.push(
                  `/${locale}/propositions/create?title=${encodeURIComponent(trimmedQuery)}`
                )
              }
            >
              {createLabel}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}