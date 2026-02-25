"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { PageOwnerNotifications } from "@/components/page-owner-notifications"
import { PageParentRequest } from "@/components/page-parent-request"
import { PageParentRequests } from "@/components/page-parent-requests"
import { PageVerificationRequest } from "@/components/page-verification-request"
import { PageAccessManager } from "@/components/page-access-manager"

type Props = {
  pageId: string
  ownerId: string
  initialDaily: boolean
  initialThreshold: number | null
  isVerified: boolean
  initialVisibility?: "public" | "private"
  trigger?: "menu" | "verificationBadge"
}

export function PageOwnerMenu({
  pageId,
  ownerId,
  initialDaily,
  initialThreshold,
  isVerified,
  initialVisibility = "public",
  trigger = "menu",
}: Props) {
  const tPage = useTranslations("PageOwner")
  const [activePanel, setActivePanel] = useState<
    "menu" | "notifications" | "parentLink" | "parentRequests" | "privateAccess" | null
  >(null)
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false)
  const openPanel = (
    panel: "notifications" | "parentLink" | "parentRequests" | "privateAccess"
  ) => {
    setActivePanel(panel)
  }

  const isVerificationBadgeTrigger = trigger === "verificationBadge"
  const activePanelLabel =
    activePanel === "menu"
      ? "Owner menu"
      : activePanel === "notifications"
      ? tPage("notifications")
      : activePanel === "parentLink"
        ? tPage("parentLink")
        : activePanel === "parentRequests"
          ? tPage("parentRequests")
          : activePanel === "privateAccess"
            ? tPage("privateAccess")
            : tPage("verification")

  if (isVerificationBadgeTrigger) {
    return (
      <>
        <button
          type="button"
          className="inline-flex h-5 w-5 shrink-0 self-center items-center justify-center rounded-full border border-dashed border-muted-foreground/60 bg-transparent text-[11px] font-semibold leading-none text-muted-foreground transition-colors hover:border-foreground/60 hover:text-foreground"
          aria-label={tPage("verification")}
          title={tPage("verification")}
          onClick={() => setVerificationDialogOpen(true)}
        >
          ✓
        </button>
        <Dialog
          open={verificationDialogOpen}
          onOpenChange={setVerificationDialogOpen}
        >
          <DialogContent className="fixed top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 max-h-[85vh] w-[92vw] max-w-[23rem] overflow-y-auto overflow-x-hidden border border-border bg-background p-6 text-foreground shadow-2xl sm:top-[45%] sm:max-w-[23rem]">
            <DialogTitle className="sr-only">{tPage("verification")}</DialogTitle>
            <PageVerificationRequest
              pageId={pageId}
              ownerId={ownerId}
              isVerified={isVerified}
            />
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        className="h-8 w-8 rounded-full px-0 text-muted-foreground hover:bg-muted/60"
        onClick={() => setActivePanel("menu")}
      >
        ⋯
      </Button>

      <Dialog
        open={activePanel !== null}
        onOpenChange={(open) => {
          if (!open) setActivePanel(null)
        }}
      >
        <DialogContent className="fixed top-2 left-1/2 -translate-x-1/2 translate-y-0 max-h-[calc(100dvh-1rem)] w-[92vw] max-w-[23rem] overflow-y-auto overflow-x-hidden border border-border bg-background p-6 text-foreground shadow-2xl sm:top-[45%] sm:-translate-y-1/2 sm:max-h-[85vh] sm:max-w-[23rem]">
          <DialogTitle className="sr-only">{activePanelLabel}</DialogTitle>
          {activePanel !== "menu" && activePanel !== null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mb-1 w-fit"
              onClick={() => setActivePanel("menu")}
            >
              ←
            </Button>
          )}
          {activePanel === "menu" && (
            <div className="space-y-1">
              <Button
                variant="ghost"
                type="button"
                className="w-full justify-start"
                onClick={() => openPanel("notifications")}
              >
                {tPage("notifications")}
              </Button>
              <Button
                variant="ghost"
                type="button"
                className="w-full justify-start"
                onClick={() => openPanel("parentLink")}
              >
                {tPage("parentLink")}
              </Button>
              <Button
                variant="ghost"
                type="button"
                className="w-full justify-start"
                onClick={() => openPanel("parentRequests")}
              >
                {tPage("parentRequests")}
              </Button>
              <Button
                variant="ghost"
                type="button"
                className="w-full justify-start"
                onClick={() => openPanel("privateAccess")}
              >
                {tPage("privateAccess")}
              </Button>
              <Button
                variant="ghost"
                type="button"
                className="w-full justify-start"
                onClick={() => {
                  setActivePanel(null)
                  setTimeout(() => setVerificationDialogOpen(true), 0)
                }}
              >
                {tPage("verification")}
              </Button>
            </div>
          )}
          {activePanel === "notifications" && (
            <PageOwnerNotifications
              pageId={pageId}
              ownerId={ownerId}
              initialDaily={initialDaily}
              initialThreshold={initialThreshold}
            />
          )}
          {activePanel === "parentLink" && (
            <PageParentRequest pageId={pageId} ownerId={ownerId} />
          )}
          {activePanel === "parentRequests" && (
            <PageParentRequests pageId={pageId} ownerId={ownerId} />
          )}
          {activePanel === "privateAccess" && (
            <PageAccessManager
              pageId={pageId}
              ownerId={ownerId}
              initialVisibility={initialVisibility}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={verificationDialogOpen} onOpenChange={setVerificationDialogOpen}>
        <DialogContent className="fixed top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 max-h-[85vh] w-[92vw] max-w-[23rem] overflow-y-auto overflow-x-hidden border border-border bg-background p-6 text-foreground shadow-2xl sm:top-[45%] sm:max-w-[23rem]">
          <DialogTitle className="sr-only">{tPage("verification")}</DialogTitle>
          <PageVerificationRequest
            pageId={pageId}
            ownerId={ownerId}
            isVerified={isVerified}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}