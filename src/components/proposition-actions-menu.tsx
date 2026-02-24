"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { MoreHorizontal } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/components/ui/toast"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"
import { PropositionVolunteerMenuAction } from "@/components/proposition-volunteers"

type Props = {
  propositionId: string
  authorId: string | null
}

export function PropositionActionsMenu({ propositionId, authorId }: Props) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("PropositionActions")
  const tEdit = useTranslations("PropositionEdit")
  const tNotify = useTranslations("PropositionNotify")
  const tCommon = useTranslations("Common")
  const { showToast } = useToast()
  const [isAuthor, setIsAuthor] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loadingNotify, setLoadingNotify] = useState(false)
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    const checkAuthor = async () => {
      const supabase = getSupabaseClient()
      if (!supabase) return
      const user = await resolveAuthUser(supabase, {
        timeoutMs: 3500,
        includeServerFallback: true,
      })
      setIsAuthor(Boolean(authorId && user?.id === authorId))
    }
    void checkAuthor()
  }, [authorId])

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
        .from("proposition_subscriptions")
        .select("proposition_id")
        .eq("proposition_id", propositionId)
        .eq("user_id", user.id)
        .maybeSingle()
      setSubscribed(Boolean(data))
    }
    fetchSubscription()
  }, [propositionId])

  const handleToggleNotify = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (!user) {
      router.push(
        `/${locale}/propositions/${propositionId}?auth=signup&next=${encodeURIComponent(`/${locale}/propositions/${propositionId}`)}`
      )
      return
    }
    setLoadingNotify(true)
    if (subscribed) {
      await supabase
        .from("proposition_subscriptions")
        .delete()
        .eq("proposition_id", propositionId)
        .eq("user_id", user.id)
      setSubscribed(false)
      showToast({
        variant: "info",
        title: tNotify("disabledTitle"),
        description: tNotify("disabledBody"),
      })
    } else {
      await supabase.from("proposition_subscriptions").insert({
        proposition_id: propositionId,
        user_id: user.id,
      })
      setSubscribed(true)
      showToast({
        variant: "success",
        title: tNotify("enabledTitle"),
        description: tNotify("enabledBody"),
      })
    }
    setLoadingNotify(false)
  }

  const handleDelete = async () => {
    if (!isAuthor || loadingDelete) return
    const supabase = getSupabaseClient()
    if (!supabase) return
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (!user || user.id !== authorId) return
    setLoadingDelete(true)
    const { error } = await supabase
      .from("propositions")
      .delete()
      .eq("id", propositionId)
      .eq("author_id", user.id)
    if (error) {
      showToast({
        variant: "error",
        title: t("deleteError"),
        description: error.message,
      })
      setLoadingDelete(false)
      return
    }
    showToast({ variant: "success", title: t("deleteSuccess") })
    setDeleteOpen(false)
    setTimeout(() => {
      router.push("/profile?view=mes-propositions")
    }, 150)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <div className="flex flex-col gap-1">
          <PropositionVolunteerMenuAction />
          {isAuthor && (
            <Link
              href={`/propositions/${propositionId}/edit`}
              className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              {tEdit("edit")}
            </Link>
          )}
          <button
            type="button"
            onClick={handleToggleNotify}
            disabled={loadingNotify}
            className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-60"
          >
            {subscribed ? t("notificationsDisable") : t("notificationsEnable")}
          </button>
          {isAuthor && (
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
                >
                  {t("delete")}
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("deleteDialogTitle")}</DialogTitle>
                  <DialogDescription>{t("deleteConfirm")}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setDeleteOpen(false)}
                  >
                    {tCommon("cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={loadingDelete}
                  >
                    {t("delete")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}