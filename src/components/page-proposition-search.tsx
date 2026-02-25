"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Code2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/components/ui/toast"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
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
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const tCommon = useTranslations("Common")
  const tStatus = useTranslations("Status")
  const tPage = useTranslations("Page")
  const tPageDashboard = useTranslations("PageDashboard")
  const { showToast } = useToast()
  const defaultBgColor = backgroundColor ?? "#ffffff"
  const defaultHeaderColor = headerColor ?? "#ffffff"
  const [value, setValue] = useState(initialQuery)
  const [statusValue, setStatusValue] = useState(status ?? "all")
  const [embedOpen, setEmbedOpen] = useState(false)
  const [bgColor, setBgColor] = useState(defaultBgColor)
  const [tableHeaderColor, setTableHeaderColor] = useState(defaultHeaderColor)
  const [avatarsEnabled, setAvatarsEnabled] = useState(showAvatars ?? true)
  const debounceRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const statusSelectContentId = useId()

  // Do not resync value from initialQuery: after our own router.replace (debounce),
  // the re-render would restore the previous value and erase recent input.

  useEffect(() => {
    setStatusValue(status ?? "all")
  }, [status])


  const resolveHexColor = (value: string, fallback: string): string => {
    const trimmed = value.trim()
    if (!trimmed) return fallback

    const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(withHash) ? withHash : fallback
  }

  const cssColorToHex = (value: string | null | undefined): string | null => {
    if (!value) return null
    const normalized = value.trim().toLowerCase()
    if (!normalized || normalized === "transparent") return null
    if (normalized.startsWith("#")) {
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(normalized)) {
        return normalized.length === 4
          ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
          : normalized
      }
      return null
    }
    const rgbaMatch = normalized.match(/^rgba?\(([^)]+)\)$/)
    if (!rgbaMatch) return null
    const parts = rgbaMatch[1].split(",").map((part) => part.trim())
    if (parts.length < 3) return null
    const r = Number.parseFloat(parts[0])
    const g = Number.parseFloat(parts[1])
    const b = Number.parseFloat(parts[2])
    const a = parts.length >= 4 ? Number.parseFloat(parts[3]) : 1
    if (![r, g, b].every((n) => Number.isFinite(n))) return null
    if (Number.isFinite(a) && a <= 0) return null
    const toHex = (n: number) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, "0")
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  }

  const resolveEffectiveBackgroundHex = (element: HTMLElement | null): string | null => {
    let current: HTMLElement | null = element
    while (current) {
      const hex = cssColorToHex(window.getComputedStyle(current).backgroundColor)
      if (hex) return hex
      current = current.parentElement
    }
    return null
  }

  useEffect(() => {
    if (!embedOpen) return
    const container =
      (containerRef.current?.closest("[data-slot='card']") as HTMLElement | null) ??
      containerRef.current
    if (!container) return

    const table = container.querySelector("[data-embed-table='true']") as HTMLElement | null
    const header = container.querySelector("[data-embed-table-header='true']") as HTMLElement | null

    const detectedBg = resolveEffectiveBackgroundHex(table)
    const detectedHeader = resolveEffectiveBackgroundHex(header) ?? detectedBg

    if (detectedBg) setBgColor(detectedBg)
    if (detectedHeader) setTableHeaderColor(detectedHeader)
  }, [embedOpen])

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

    // Keep visual embed params stable in embed routes, otherwise the URL rewrite
    // drops them after mount and the table reverts to default colors/avatars.
    if (basePath?.includes("/embed/")) {
      next.set("bg", resolveHexColor(bgColor, defaultBgColor))
      next.set("header", resolveHexColor(tableHeaderColor, defaultHeaderColor))
      next.set("avatars", avatarsEnabled ? "1" : "0")
      const currentV = searchParams.get("v")
      if (currentV) next.set("v", currentV)
    }

    return next
  }, [
    avatarsEnabled,
    basePath,
    bgColor,
    defaultBgColor,
    defaultHeaderColor,
    limit,
    searchParams,
    sort,
    statusOrder,
    statusSort,
    tab,
    tableHeaderColor,
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
      const currentPath = pathname ?? destination
      const currentQuery = searchParams.toString()

      // Avoid replace loops when target URL is already the current one.
      if (currentPath === destination && currentQuery === queryString) {
        return
      }

      router.replace(queryString ? `${destination}?${queryString}` : destination)
    }, 300)

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }
    }
  }, [basePath, locale, params, pathname, router, searchParams, slug])

  const buildEmbedLink = () => {
    if (!embedBaseUrl) return
    const next = new URL(embedBaseUrl)
    const safeBg = resolveHexColor(bgColor, defaultBgColor)
    const safeHeader = resolveHexColor(tableHeaderColor, defaultHeaderColor)
    next.searchParams.set("bg", safeBg)
    next.searchParams.set("header", safeHeader)
    next.searchParams.set("avatars", avatarsEnabled ? "1" : "0")
    next.searchParams.set("v", String(Date.now()))
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
    <div ref={containerRef} className="flex w-full flex-wrap gap-2 md:flex-nowrap md:items-center">
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
        <SelectContent id={statusSelectContentId}>
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
                    placeholder="#ffffff"
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
                    placeholder="#ffffff"
                    className="h-9 pl-8"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label id="embed-show-avatars-label" className="text-xs text-foreground">
                  {tPageDashboard("embedShowAvatarsLabel")}
                </label>
                <ToggleSwitch
                  id="embed-show-avatars"
                  checked={avatarsEnabled}
                  ariaLabelledBy="embed-show-avatars-label"
                  onCheckedChange={setAvatarsEnabled}
                />
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