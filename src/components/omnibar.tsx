"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import debounce from "lodash/debounce"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import { getSupabaseClient } from "@/utils/supabase/client"

type PropositionResult = {
  id: string
  title: string
  status: string | null
  votes_count: number | null
  pages?: { name: string | null } | null
}

const sanitizeQuery = (value: string) => value.replace(/[%_]/g, "\\$&")

const statusVariants: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  Open: "secondary",
  "In Progress": "default",
  Done: "secondary",
  "Won't Do": "outline",
}

export function Omnibar() {
  const router = useRouter()
  const requestId = useRef(0)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PropositionResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedQuery = useMemo(() => query.trim(), [query])

  const debouncedSearch = useMemo(
    () =>
      debounce(async (value: string) => {
        const supabase = getSupabaseClient()
        if (!supabase) {
          setError("Supabase non configuré.")
          setResults([])
          setLoading(false)
          return
        }

        const currentRequest = (requestId.current += 1)
        setLoading(true)
        setError(null)
        const safeQuery = sanitizeQuery(value)
        const { data, error: queryError } = await supabase
          .from("propositions")
          .select("id, title, status, votes_count, pages(name)")
          .ilike("title", `%${safeQuery}%`)
          .order("votes_count", { ascending: false })
          .limit(8)

        if (currentRequest !== requestId.current) return

        if (queryError) {
          setError(queryError.message)
          setResults([])
        } else {
          const unique = new Map<string, PropositionResult>()
          for (const item of data ?? []) {
            unique.set(item.id, item)
          }
          setResults(Array.from(unique.values()))
        }

        setLoading(false)
      }, 300),
    []
  )

  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (!value.trim()) {
      requestId.current += 1
      setResults([])
      setError(null)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!trimmedQuery) return
    debouncedSearch(trimmedQuery)
    return () => debouncedSearch.cancel()
  }, [debouncedSearch, trimmedQuery])

  return (
    <div className="w-full max-w-2xl">
      <Command className="rounded-2xl border border-border bg-background shadow-xl">
        <div className="flex items-center gap-3 px-4 py-4">
          <CommandInput
            value={query}
            onValueChange={handleQueryChange}
            placeholder="Rechercher ou créer une proposition..."
            className="h-12 text-base"
          />
        </div>
        <div className="max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto pb-3 pl-9 pr-3">
          {loading && (
            <CommandItem disabled className="text-sm text-muted-foreground">
              Recherche en cours...
            </CommandItem>
          )}
          {!loading && error && (
            <CommandItem disabled className="text-sm text-destructive">
              {error}
            </CommandItem>
          )}
          {!loading && !error && trimmedQuery && results.length === 0 && (
            <CommandItem disabled className="px-0 text-sm text-muted-foreground">
              Aucune proposition trouvée.
            </CommandItem>
          )}
          {results.length > 0 && (
            <CommandGroup className="p-0">
              {results.map((item) => {
                const statusLabel = item.status ?? "Open"
                const votes = item.votes_count ?? 0
                const pageName = item.pages?.name
                return (
                  <CommandItem
                    key={item.id}
                    value={item.title}
                    className="px-0"
                    onSelect={() => router.push(`/propositions/${item.id}`)}
                  >
                    <div className="flex w-full items-center justify-between gap-4">
                      <span className="truncate font-medium text-foreground">
                        {item.title}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {pageName && (
                          <Badge variant="outline" className="capitalize">
                            {pageName}
                          </Badge>
                        )}
                        <Badge variant={statusVariants[statusLabel] ?? "outline"}>
                          {statusLabel}
                        </Badge>
                        <span>{votes} votes</span>
                      </div>
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
                router.push(
                  `/propositions/create?title=${encodeURIComponent(trimmedQuery)}`
                )
              }}
            >
              <div className="flex w-full items-center justify-between gap-4">
                <span className="truncate font-medium text-foreground">
                  {query}
                </span>
                <Badge variant="outline">+ Ajouter</Badge>
              </div>
            </CommandItem>
          )}
        </div>
      </Command>
    </div>
  )
}
