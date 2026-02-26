"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { PageAccessManager } from "@/components/page-access-manager"

type Props = {
  pageId: string
  ownerId: string
  initialVisibility?: "public" | "private"
}

export function PageOwnerMenu({
  pageId,
  ownerId,
  initialVisibility = "public",
}: Props) {
  const tPage = useTranslations("PageOwner")
  const [open, setOpen] = useState(false)

  if (initialVisibility !== "private") return null

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        type="button"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <UserPlus className="size-4" />
        {tPage("addMembers")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="fixed top-2 left-1/2 -translate-x-1/2 translate-y-0 max-h-[calc(100dvh-1rem)] w-[92vw] max-w-[23rem] overflow-y-auto overflow-x-hidden border border-border bg-background p-6 text-foreground shadow-2xl sm:top-[45%] sm:-translate-y-1/2 sm:max-h-[85vh] sm:max-w-[23rem]">
          <DialogTitle className="sr-only">{tPage("addMembers")}</DialogTitle>
          <PageAccessManager
            pageId={pageId}
            ownerId={ownerId}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
