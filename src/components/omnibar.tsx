"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import debounce from "lodash/debounce"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import { getSupabaseClient } from "@/utils/supabase/client"
import { Plus } from "lucide-react"

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
  const [pageResults, setPageResults] = useState<PageResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const placeholderSamples = useMemo(
    () => [
      "UberEats : Proposer une option \"Commande groupée\"",
      "Spotify : Créer un mode \"Sommeil\" qui baisse progressivement le volume de la musique sur les 15 dernières minutes.",
      "LinkedIn : Ajouter un filtre \"Salaire affiché\" pour masquer les offres d'emploi qui ne mentionnent pas de fourchette de rémunération",
      "Ouvrir le Metro 24H/24 à Paris",
      "SNCF : Indiquer les prix les moins chers par jour à l'ouverture du calendrier",
    ],
    []
  )
  const randomPlaceholder = useMemo(
    () =>
      placeholderSamples[Math.floor(Math.random() * placeholderSamples.length)],
    [placeholderSamples]
  )

  const trimmedQuery = useMemo(() => query.trim(), [query])

  const debouncedSearch = useMemo(
    () =>
      debounce(async (value: string) => {
        const supabase = getSupabaseClient()
        if (!supabase) {
          setError("Supabase non configuré.")
          setResults([])
          setPageResults([])
          setLoading(false)
          return
        }

        const currentRequest = (requestId.current += 1)
        setLoading(true)
        setError(null)
        const safeQuery = sanitizeQuery(value)
        const [propositionsResponse, pagesResponse] = await Promise.all([
          supabase
            .from("propositions")
            .select("id, title, status, votes_count, pages(name)")
            .or(`title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`)
            .order("votes_count", { ascending: false })
            .limit(8),
          supabase
            .from("pages")
            .select("id, name, slug")
            .ilike("name", `%${safeQuery}%`)
            .order("name", { ascending: true })
            .limit(6),
        ])

        if (currentRequest !== requestId.current) return

        if (propositionsResponse.error || pagesResponse.error) {
          setError(
            propositionsResponse.error?.message ||
              pagesResponse.error?.message ||
              "Erreur de recherche."
          )
          setResults([])
          setPageResults([])
        } else {
          const unique = new Map<string, PropositionResult>()
          for (const item of propositionsResponse.data ?? []) {
            unique.set(item.id, item)
          }
          setResults(Array.from(unique.values()))
          setPageResults(pagesResponse.data ?? [])
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
      setPageResults([])
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
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                aria-label="Créer"
              >
                <Plus className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1">
              <button
                type="button"
                onClick={() => {
                  router.push(
                    trimmedQuery
                      ? `/propositions/create?title=${encodeURIComponent(
                          trimmedQuery
                        )}`
                      : "/propositions/create"
                  )
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                Créer une proposition
              </button>
              <button
                type="button"
                onClick={() => {
                  router.push(
                    trimmedQuery
                      ? `/pages/create?name=${encodeURIComponent(trimmedQuery)}`
                      : "/pages/create"
                  )
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                Créer une page
              </button>
            </PopoverContent>
          </Popover>
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
          {!loading &&
            !error &&
            trimmedQuery &&
            results.length === 0 &&
            pageResults.length === 0 && (
            <CommandItem disabled className="px-0 text-sm text-muted-foreground">
              Aucune proposition trouvée.
            </CommandItem>
          )}
          {pageResults.length > 0 && (
            <CommandGroup className="p-0">
              {pageResults.map((page) => (
                <CommandItem
                  key={page.id}
                  value={`page-${page.name}`}
                  onSelect={() => {
                    if (!page.slug) return
                    router.push(`/pages/${page.slug}`)
                  }}
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="truncate">{page.name}</span>
                    <Badge variant="outline">Page</Badge>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {results.length > 0 && (
            <CommandGroup className="p-0">
              {results.map((item) => {
                const statusLabel = item.status ?? "Open"
                const votes = item.votes_count ?? 0
                const pageName = Array.isArray(item.pages)
                  ? item.pages[0]?.name
                  : item.pages?.name
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
                <Badge variant="outline">+ Ajouter une proposition</Badge>
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
                router.push(
                  `/pages/create?name=${encodeURIComponent(trimmedQuery)}`
                )
              }}
            >
              <div className="flex w-full items-center justify-between gap-4">
                <span className="truncate font-medium text-foreground">
                  {query}
                </span>
                <Badge variant="outline">+ Créer une page</Badge>
              </div>
            </CommandItem>
          )}
        </div>
      </Command>
    </div>
  )
}
