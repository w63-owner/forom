"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { getSupabaseClient } from "@/lib/supabase/client"

type PropositionResult = {
  id: string
  title: string
  votes_count: number | null
}

const sanitizeQuery = (value: string) => value.replace(/[%_]/g, "\\$&")

export function OmniSearch() {
  const router = useRouter()
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

    const handle = setTimeout(async () => {
      const supabase = getSupabaseClient()
      if (!supabase) {
        setError("Supabase non configuré.")
        setResults([])
        return
      }

      setLoading(true)
      setError(null)
      const safeQuery = sanitizeQuery(trimmedQuery)
      const { data, error: queryError } = await supabase
        .from("propositions")
        .select("id, title, votes_count")
        .or(`title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`)
        .order("votes_count", { ascending: false })
        .limit(8)

      if (queryError) {
        setError(queryError.message)
        setResults([])
      } else {
        setResults(data ?? [])
      }

      setLoading(false)
    }, 300)

    return () => clearTimeout(handle)
  }, [trimmedQuery])

  const createLabel = trimmedQuery
    ? `Créer la proposition : "${trimmedQuery}"`
    : "Créer une proposition"

  return (
    <div id="omnibox" className="w-full max-w-2xl">
      <Command className="relative overflow-visible rounded-2xl border border-border bg-background shadow-xl">
        <div className="flex items-center gap-3 px-4 py-4">
          <Search className="h-5 w-5 text-muted-foreground" />
          <CommandInput
            value={query}
            onValueChange={handleQueryChange}
            placeholder="Décrivez votre idée ou cherchez une proposition..."
            className="h-12 text-base"
          />
        </div>
        <CommandList className="absolute left-0 right-0 top-full z-10 rounded-b-2xl border border-border border-t-0 bg-background shadow-xl">
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
          <CommandEmpty>
            {trimmedQuery ? "Aucune proposition trouvée." : "Commencez à taper."}
          </CommandEmpty>
          {results.length > 0 && (
            <CommandGroup heading="Propositions similaires">
              {results.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.title}
                  onSelect={() => router.push(`/propositions/${item.id}`)}
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="truncate">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.votes_count ?? 0} votes
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Créer">
            <CommandItem
              value={`create-${trimmedQuery}`}
              onSelect={() =>
                router.push(
                  `/propositions/create?title=${encodeURIComponent(trimmedQuery)}`
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
