"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Code2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Props = {
  slug: string
  initialQuery: string
  status: string | null
  sort: string
  statusSort: string | null
  statusOrder: string | null
  tab?: "propositions" | "nouveautes"
  basePath?: string
  theme?: string | null
  limit?: number | null
  embedCodeToCopy?: string | null
}

export function PagePropositionSearch({
  slug,
  initialQuery,
  status,
  sort,
  statusSort,
  statusOrder,
  tab = "propositions",
  basePath,
  theme,
  limit,
  embedCodeToCopy,
}: Props) {
  const router = useRouter()
  const locale = useLocale()
  const tCommon = useTranslations("Common")
  const tStatus = useTranslations("Status")
  const tPage = useTranslations("Page")
  const tPageDashboard = useTranslations("PageDashboard")
  const { showToast } = useToast()
  const [value, setValue] = useState(initialQuery)
  const [statusValue, setStatusValue] = useState(status ?? "all")
  const debounceRef = useRef<number | null>(null)

  // Do not resync value from initialQuery: after our own router.replace (debounce),
  // the re-render would restore the previous value and erase recent input.

  useEffect(() => {
    setStatusValue(status ?? "all")
  }, [status])


  const params = useMemo(() => {
    const next = new URLSearchParams()
    if (value.trim()) next.set("q", value.trim())
    if (statusValue && statusValue !== "all") next.set("status", statusValue)
    if (sort) next.set("sort", sort)
    if (statusSort) next.set("statusSort", statusSort)
    if (statusOrder) next.set("statusOrder", statusOrder)
    if (tab) next.set("tab", tab)
    if (theme) next.set("theme", theme)
    if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
      next.set("limit", String(Math.floor(limit)))
    }
    return next
  }, [limit, sort, statusOrder, statusSort, tab, theme, value, statusValue])

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
    }
    debounceRef.current = window.setTimeout(() => {
      const queryString = params.toString()
      const destination = basePath ?? `/${locale}/pages/${slug}`
      router.replace(queryString ? `${destination}?${queryString}` : destination)
    }, 300)

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }
    }
  }, [basePath, locale, params, router, slug])

  const copyEmbedCode = async () => {
    if (!embedCodeToCopy) return
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable")
      }
      await navigator.clipboard.writeText(embedCodeToCopy)
      showToast({
        variant: "success",
        title: tPageDashboard("embedCopySuccess"),
        description: tPageDashboard("embedCopyReady"),
      })
    } catch {
      showToast({
        variant: "error",
        title: tPageDashboard("embedCopyError"),
      })
    }
  }

  return (
    <div className="flex w-full flex-wrap gap-2 md:flex-nowrap md:items-center">
      <input
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={
          tab === "nouveautes"
            ? tPage("searchUpdates")
            : tCommon("searchOrAddProposition")
        }
        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-w-0 md:flex-1 md:max-w-sm"
      />
      <Select value={statusValue} onValueChange={setStatusValue}>
        <SelectTrigger className="h-10 w-full md:w-48 md:shrink-0">
          <SelectValue placeholder={tCommon("status")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{tStatus("all")}</SelectItem>
          <SelectItem value="Open">{tStatus("open")}</SelectItem>
          <SelectItem value="In Progress">{tStatus("inProgress")}</SelectItem>
          <SelectItem value="Done">{tStatus("done")}</SelectItem>
          <SelectItem value="Won't Do">{tStatus("wontDo")}</SelectItem>
        </SelectContent>
      </Select>
      {embedCodeToCopy && (
        <Badge
          asChild
          variant="outline"
          className="hidden h-10 cursor-pointer items-center rounded-md px-3 text-xs md:ml-auto md:inline-flex md:shrink-0"
        >
          <button type="button" onClick={copyEmbedCode}>
            <Code2 className="size-3.5" aria-hidden="true" />
            {tPageDashboard("embedCopyBadge")}
          </button>
        </Badge>
      )}
    </div>
  )
}