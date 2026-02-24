"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Code2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
  embedBaseUrl?: string | null
  backgroundColor?: string | null
  headerColor?: string | null
  showAvatars?: boolean | null
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
  embedBaseUrl,
  backgroundColor,
  headerColor,
  showAvatars,
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
  const [embedOpen, setEmbedOpen] = useState(false)
  const [bgColor, setBgColor] = useState(backgroundColor ?? "#f8fafc")
  const [tableHeaderColor, setTableHeaderColor] = useState(headerColor ?? "#f1f5f9")
  const [avatarsEnabled, setAvatarsEnabled] = useState(showAvatars ?? true)
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
  }, [
    limit,
    sort,
    statusOrder,
    statusSort,
    tab,
    theme,
    value,
    statusValue,
  ])

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

  const buildEmbedLink = () => {
    if (!embedBaseUrl) return
    const next = new URL(embedBaseUrl)
    const sanitizeHex = (value: string): string | null => {
      const trimmed = value.trim()
      return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed : null
    }
    const safeBg = sanitizeHex(bgColor)
    const safeHeader = sanitizeHex(tableHeaderColor)
    if (safeBg) next.searchParams.set("bg", safeBg)
    else next.searchParams.delete("bg")
    if (safeHeader) next.searchParams.set("header", safeHeader)
    else next.searchParams.delete("header")
    next.searchParams.set("avatars", avatarsEnabled ? "1" : "0")
    return next.toString()
  }

  const handleGenerateEmbed = async () => {
    const generatedEmbedLink = buildEmbedLink()
    if (!generatedEmbedLink) return
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable")
      }
      const iframeCode = `<iframe src="${generatedEmbedLink}" width="100%" height="640" style="border:0;" loading="lazy"></iframe>`
      await navigator.clipboard.writeText(iframeCode)
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
      {embedBaseUrl && (
        <Popover open={embedOpen} onOpenChange={setEmbedOpen}>
          <PopoverTrigger asChild>
            <Badge
              asChild
              variant="outline"
              className="hidden h-10 cursor-pointer items-center rounded-md px-3 text-xs md:ml-auto md:inline-flex md:shrink-0"
            >
              <button type="button">
                <Code2 className="size-3.5" aria-hidden="true" />
                {tPageDashboard("embedCopyBadge")}
              </button>
            </Badge>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[26rem] space-y-3"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <div className="space-y-1">
              <p className="text-sm font-medium">{tPageDashboard("embedPanelTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {tPageDashboard("embedPanelDescription")}
              </p>
            </div>
            <div className="grid gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  {tPageDashboard("embedBgColorLabel")}
                </label>
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-border"
                    style={{ backgroundColor: bgColor }}
                  />
                  <Input
                    value={bgColor}
                    onChange={(event) => setBgColor(event.target.value)}
                    placeholder="#f8fafc"
                    className="h-9 pl-8"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  {tPageDashboard("embedHeaderColorLabel")}
                </label>
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-border"
                    style={{ backgroundColor: tableHeaderColor }}
                  />
                  <Input
                    value={tableHeaderColor}
                    onChange={(event) => setTableHeaderColor(event.target.value)}
                    placeholder="#f1f5f9"
                    className="h-9 pl-8"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label id="embed-show-avatars-label" className="text-xs text-foreground">
                  {tPageDashboard("embedShowAvatarsLabel")}
                </label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={avatarsEnabled}
                  aria-labelledby="embed-show-avatars-label"
                  onClick={() => setAvatarsEnabled((prev) => !prev)}
                  className={`focus-ring relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                    avatarsEnabled
                      ? "border-emerald-500/70 bg-emerald-500/25"
                      : "border-border bg-muted/60"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-background shadow transition-transform ${
                      avatarsEnabled ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <button
                type="button"
                onClick={handleGenerateEmbed}
                className="h-10 w-full rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {tPageDashboard("embedGenerateLink")}
              </button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}