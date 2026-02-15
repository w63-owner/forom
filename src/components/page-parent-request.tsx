"use client"

import { useEffect, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import { usePageSearch, type PageResult } from "@/hooks/use-page-search"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"
import { useToast } from "@/components/ui/toast"

type Props = {
  pageId: string
  ownerId: string
}

type ParentRequest = {
  id: string
  status: string
  parent_page_id: string
  created_at: string
  parent?: {
    id: string
    name: string
    slug: string
  } | null
}

type ParentPage = {
  id: string
  name: string
  slug: string
}

export function PageParentRequest({ pageId, ownerId }: Props) {
  const t = useTranslations("PageParent")
  const tCommon = useTranslations("Common")
  const locale = useLocale()
  const { showToast } = useToast()
  const [parentOpen, setParentOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [currentParent, setCurrentParent] = useState<ParentPage | null>(null)
  const [currentRequest, setCurrentRequest] = useState<ParentRequest | null>(null)
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

  const statusLabels = useMemo(
    () => ({
      pending: t("pending"),
      approved: t("approved"),
      rejected: t("rejected"),
    }),
    [t]
  )

  const loadCurrent = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError(tCommon("loginRequiredTitle"))
      return
    }
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (!user || user.id !== ownerId) return

    const { data: pageData } = await supabase
      .from("pages")
      .select("parent_page_id")
      .eq("id", pageId)
      .maybeSingle()

    if (pageData?.parent_page_id) {
      const { data: parentData } = await supabase
        .from("pages")
        .select("id, name, slug")
        .eq("id", pageData.parent_page_id)
        .maybeSingle()
      setCurrentParent((parentData as ParentPage | null) ?? null)
    } else {
      setCurrentParent(null)
    }

    const { data: requestData } = await supabase
      .from("page_parent_requests")
      .select(
        "id, status, parent_page_id, created_at, parent:pages!page_parent_requests_parent_page_id_fkey(id, name, slug)"
      )
      .eq("child_page_id", pageId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (requestData) {
      const parent = Array.isArray(requestData.parent)
        ? requestData.parent[0] ?? null
        : requestData.parent ?? null
      setCurrentRequest({
        id: requestData.id,
        status: requestData.status,
        parent_page_id: requestData.parent_page_id,
        created_at: requestData.created_at,
        parent,
      })
    } else {
      setCurrentRequest(null)
    }
  }

  useEffect(() => {
    void loadCurrent()
  }, [pageId, ownerId])

  const handleSelectParent = (page: PageResult) => {
    setSelectedParent(page)
    setParentQuery(page.name, { keepSelection: true, touched: false })
    clearParentResults()
    setParentOpen(false)
  }

  const handleClearParent = () => {
    setSelectedParent(null)
    setParentQuery("", { touched: false })
    clearParentResults()
  }

  const handleSubmit = async () => {
    if (!selectedParent?.id) return
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError(t("requestError"))
      return
    }
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (!user || user.id !== ownerId) {
      setError(t("requestError"))
      return
    }

    setLoading(true)
    setError(null)
    const { error: requestError } = await supabase
      .from("page_parent_requests")
      .upsert(
        {
          child_page_id: pageId,
          parent_page_id: selectedParent.id,
          requested_by: user.id,
        },
        { onConflict: "child_page_id" }
      )

    if (requestError) {
      setError(requestError.message)
      setLoading(false)
      return
    }

    setStatusMessage(t("requestSent"))
    showToast({ variant: "info", title: t("requestSent") })
    setLoading(false)
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "page_parent_request",
        pageId: selectedParent.id,
        childPageId: pageId,
        actorUserId: user.id,
        locale,
      }),
    }).catch(() => null)
    void loadCurrent()
  }

  const statusLabel = currentRequest
    ? statusLabels[currentRequest.status as keyof typeof statusLabels] ??
      currentRequest.status
    : null

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4 text-sm">
      <p className="font-medium text-foreground">{t("title")}</p>
      {currentParent ? (
        <p className="text-muted-foreground">
          {t("currentParent", { name: currentParent.name })}
        </p>
      ) : (
        <p className="text-muted-foreground">{t("noParent")}</p>
      )}
      {statusLabel && (
        <p className="text-muted-foreground">{t("requestStatus", { status: statusLabel })}</p>
      )}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("selectLabel")}
        </label>
        <Popover open={parentOpen} onOpenChange={setParentOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between" type="button">
              {selectedParent?.name || t("selectPlaceholder")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-full p-0">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder={t("selectPlaceholder")}
                value={parentQuery}
                onValueChange={(value) => setParentQuery(value)}
              />
              <CommandGroup>
                {parentLoading && (
                  <CommandItem disabled>{tCommon("loading")}</CommandItem>
                )}
                {!parentLoading &&
                  parentResults.map((page) => (
                    <CommandItem
                      key={page.id}
                      value={page.name}
                      onSelect={() => handleSelectParent(page)}
                    >
                      {page.name}
                    </CommandItem>
                  ))}
                {!parentLoading &&
                  parentTouched &&
                  parentResults.length === 0 &&
                  !parentError && (
                    <CommandItem disabled>{t("noResults")}</CommandItem>
                  )}
                {parentError && <CommandItem disabled>{parentError}</CommandItem>}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
        {selectedParent && (
          <Alert variant="success" className="items-center">
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-sm">
                {t("currentParent", { name: selectedParent.name })}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={handleClearParent}>
                {tCommon("remove")}
              </Button>
            </div>
          </Alert>
        )}
        <p className="text-xs text-muted-foreground">{t("requestNote")}</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {statusMessage && <p className="text-sm text-muted-foreground">{statusMessage}</p>}
      <Button onClick={handleSubmit} disabled={!selectedParent || loading}>
        {loading ? tCommon("saving") : t("submit")}
      </Button>
    </div>
  )
}