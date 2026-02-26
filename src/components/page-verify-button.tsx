"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { PageVerificationRequest } from "@/components/page-verification-request"

type Props = {
  pageId: string
  ownerId: string
}

export function PageVerifyButton({ pageId, ownerId }: Props) {
  const [open, setOpen] = useState(false)
  const t = useTranslations("PageVerification")

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-dashed border-muted-foreground/60 px-1.5 text-muted-foreground/70 transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
        aria-label={t("requestButton")}
        title={t("requestButton")}
      >
        <span className="text-[8px] font-semibold leading-none">✓</span>
        <span className="text-[10px] font-medium leading-none">{t("verify")}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="fixed top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 max-h-[85vh] w-[92vw] max-w-[23rem] overflow-y-auto overflow-x-hidden border border-border bg-background p-6 text-foreground shadow-2xl sm:top-[45%] sm:max-w-[23rem]">
          <PageVerificationRequest
            pageId={pageId}
            ownerId={ownerId}
            isVerified={false}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
