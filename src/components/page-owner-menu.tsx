"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Bell, BellOff, EllipsisVertical, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { PageAccessManager } from "@/components/page-access-manager"
import { useToast } from "@/components/ui/toast"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"

type Props = {
  pageId: string
  ownerId: string
  isOwner: boolean
  initialVisibility?: "public" | "private"
}

export function PageOwnerMenu({
  pageId,
  ownerId,
  isOwner,
  initialVisibility = "public",
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const tPage = useTranslations("PageOwner")
  const tSub = useTranslations("PageSubscribe")
  const { showToast } = useToast()

  const [menuOpen, setMenuOpen] = useState(false)
  const [accessOpen, setAccessOpen] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [subLoading, setSubLoading] = useState(false)

  const isPrivate = initialVisibility === "private"

  useEffect(() => {
    const fetchSubscription = async () => {
      const supabase = getSupabaseClient()
      if (!supabase) return
      const user = await resolveAuthUser(supabase, {
        timeoutMs: 3500,
        includeServerFallback: true,
      })
      if (!user) return
      const { data } = await supabase
        .from("page_subscriptions")
        .select("page_id")
        .eq("page_id", pageId)
        .eq("user_id", user.id)
        .maybeSingle()
      setSubscribed(Boolean(data))
    }
    fetchSubscription()
  }, [pageId])

  const handleToggleSubscribe = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (!user) {
      const currentPath = `${pathname || `/${locale}`}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.set("auth", "signup")
      nextParams.set("next", currentPath)
      router.replace(`${pathname || `/${locale}`}?${nextParams.toString()}`)
      return
    }
    setSubLoading(true)
    if (subscribed) {
      await supabase
        .from("page_subscriptions")
        .delete()
        .eq("page_id", pageId)
        .eq("user_id", user.id)
      setSubscribed(false)
      showToast({
        variant: "info",
        title: tSub("unsubscribedTitle"),
        description: tSub("unsubscribedBody"),
      })
    } else {
      await supabase.from("page_subscriptions").insert({
        page_id: pageId,
        user_id: user.id,
      })
      setSubscribed(true)
      showToast({
        variant: "success",
        title: tSub("subscribedTitle"),
        description: tSub("subscribedBody"),
      })
    }
    setSubLoading(false)
  }

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={tPage("menuAria")}
          >
            <EllipsisVertical className="size-4.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-48 gap-0 rounded-xl border border-border/70 bg-card p-1.5 shadow-xl"
        >
          <button
            type="button"
            disabled={subLoading}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground hover:bg-muted disabled:opacity-50"
            onClick={() => {
              setMenuOpen(false)
              handleToggleSubscribe()
            }}
          >
            {subscribed ? (
              <BellOff className="size-4 text-muted-foreground" />
            ) : (
              <Bell className="size-4 text-muted-foreground" />
            )}
            {subscribed ? tPage("unsubscribe") : tPage("subscribe")}
          </button>
          {isOwner && isPrivate && (
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground hover:bg-muted"
              onClick={() => {
                setMenuOpen(false)
                setAccessOpen(true)
              }}
            >
              <UserPlus className="size-4 text-muted-foreground" />
              {tPage("addMembers")}
            </button>
          )}
        </PopoverContent>
      </Popover>

      {isOwner && isPrivate && (
        <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
          <DialogContent className="fixed top-2 left-1/2 -translate-x-1/2 translate-y-0 max-h-[calc(100dvh-1rem)] w-[92vw] max-w-[24rem] overflow-y-auto overflow-x-hidden border border-border bg-background px-5 py-5 text-foreground shadow-2xl sm:top-[45%] sm:-translate-y-1/2 sm:max-h-[85vh] sm:max-w-[24rem]">
            <DialogTitle className="sr-only">{tPage("addMembers")}</DialogTitle>
            <PageAccessManager
              pageId={pageId}
              ownerId={ownerId}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
