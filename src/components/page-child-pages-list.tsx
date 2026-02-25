"use client"

import { useId, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/components/ui/toast"
import { usePageSearch, type PageResult } from "@/hooks/use-page-search"

type ChildPage = {
  id: string
  name: string | null
  slug: string | null
}

type Props = {
  childPages: ChildPage[]
  parentPageId: string
  isOwner: boolean
  locale: string
  title: string
}

export function PageChildPagesList({
  childPages,
  parentPageId,
  isOwner,
  locale,
  title,
}: Props) {
  const t = useTranslations("PageDashboard")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const { showToast } = useToast()
  const [childToUnlink, setChildToUnlink] = useState<ChildPage | null>(null)
  const [unlinking, setUnlinking] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const addChildPopoverContentId = useId()
  const [requestingChildId, setRequestingChildId] = useState<string | null>(null)
  const {
    query: childQuery,
    setQuery: setChildQuery,
    results: childResults,
    loading: childLoading,
    error: childError,
    touched: childTouched,
    clearResults: clearChildResults,
  } = usePageSearch({
    enabled: addOpen,
  })

  const existingChildIds = useMemo(() => new Set(childPages.map((child) => child.id)), [childPages])
  const selectableResults = useMemo(
    () =>
      childResults.filter(
        (page) => page.id !== parentPageId && !existingChildIds.has(page.id)
      ),
    [childResults, existingChildIds, parentPageId]
  )

  const handleConfirmUnlink = async () => {
    if (!childToUnlink) return
    setUnlinking(true)
    try {
      const res = await fetch("/api/pages/unlink-child", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentPageId,
          childPageId: childToUnlink.id,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        showToast({
          variant: "error",
          title: data.error ?? t("unlinkChildError"),
        })
        return
      }
      setChildToUnlink(null)
      router.refresh()
    } catch {
      showToast({ variant: "error", title: t("unlinkChildError") })
    } finally {
      setUnlinking(false)
    }
  }

  const handleSelectChild = async (page: PageResult) => {
    if (requestingChildId) return
    setRequestingChildId(page.id)
    try {
      const response = await fetch("/api/pages/parent-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentPageId,
          childPageId: page.id,
        }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null
      if (!response.ok || !payload?.ok) {
        showToast({
          variant: "error",
          title: payload?.error ?? t("addChildRequestError"),
        })
        return
      }

      showToast({
        variant: "success",
        title: t("addChildRequestSent", { childName: page.name }),
      })
      setAddOpen(false)
      setChildQuery("", { touched: false })
      clearChildResults()
      router.refresh()
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "page_parent_request",
          pageId: parentPageId,
          childPageId: page.id,
          locale,
        }),
      }).catch(() => null)
    } catch {
      showToast({
        variant: "error",
        title: t("addChildRequestError"),
      })
    } finally {
      setRequestingChildId(null)
    }
  }

  return (
    <>
      <div className="space-y-2 pt-2">
        <p className="font-semibold text-lg text-foreground">{title}</p>
        <div className="flex flex-wrap gap-2">
          {childPages.map((child) => (
            <span
              key={child.id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-sm text-foreground transition hover:bg-muted"
            >
              <Link
                href={`/${locale}/pages/${child.slug ?? ""}`}
                className="hover:underline"
              >
                {child.name ?? ""}
              </Link>
              {isOwner && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    setChildToUnlink(child)
                  }}
                  className="-mr-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={t("unlinkChildConfirmTitle")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          ))}
          <Popover
            open={addOpen}
            onOpenChange={(open) => {
              setAddOpen(open)
              if (!open) {
                setChildQuery("", { touched: false })
                clearChildResults()
              }
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-background px-3 py-1 text-sm text-foreground transition hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("addChildButton")}
              </button>
            </PopoverTrigger>
            <PopoverContent id={addChildPopoverContentId} align="start" className="w-80 p-0">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder={t("addChildSearchPlaceholder")}
                  value={childQuery}
                  onValueChange={(value) => setChildQuery(value)}
                />
                <CommandGroup>
                  {childLoading && <CommandItem disabled>{tCommon("loading")}</CommandItem>}
                  {!childLoading &&
                    selectableResults.map((page) => (
                      <CommandItem
                        key={page.id}
                        value={page.name}
                        onSelect={() => void handleSelectChild(page)}
                        disabled={requestingChildId === page.id}
                      >
                        {page.name}
                      </CommandItem>
                    ))}
                  {!childLoading &&
                    childTouched &&
                    selectableResults.length === 0 &&
                    !childError && (
                      <>
                        <CommandItem disabled>{t("addChildNoResults")}</CommandItem>
                        <CommandItem
                          value="create-page"
                          onSelect={() => {
                            setAddOpen(false)
                            router.push(`/${locale}/pages/create`)
                          }}
                        >
                          {t("addChildCreatePage")}
                        </CommandItem>
                      </>
                    )}
                  {childError && <CommandItem disabled>{childError}</CommandItem>}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Dialog open={!!childToUnlink} onOpenChange={(open) => !open && setChildToUnlink(null)}>
        <DialogContent showCloseButton={!unlinking}>
          <DialogHeader>
            <DialogTitle>{t("unlinkChildConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {childToUnlink
                ? t("unlinkChildConfirmDescription", {
                    childName: childToUnlink.name ?? "",
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton={false}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setChildToUnlink(null)}
              disabled={unlinking}
            >
              {t("unlinkChildCancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmUnlink}
              disabled={unlinking}
            >
              {unlinking ? tCommon("loading") : t("unlinkChildConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}