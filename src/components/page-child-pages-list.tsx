"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"

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