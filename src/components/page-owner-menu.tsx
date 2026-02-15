"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PageOwnerNotifications } from "@/components/page-owner-notifications"
import { PageParentRequest } from "@/components/page-parent-request"
import { PageParentRequests } from "@/components/page-parent-requests"
import { PageVerificationRequest } from "@/components/page-verification-request"

type Props = {
  pageId: string
  ownerId: string
  initialDaily: boolean
  initialThreshold: number | null
  isVerified: boolean
}

export function PageOwnerMenu({
  pageId,
  ownerId,
  initialDaily,
  initialThreshold,
  isVerified,
}: Props) {
  const tPage = useTranslations("PageOwner")
  const tCommon = useTranslations("Common")
  const [showNotifications, setShowNotifications] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const [showParentLink, setShowParentLink] = useState(false)
  const [showParentRequests, setShowParentRequests] = useState(false)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 rounded-full px-0 text-muted-foreground hover:bg-muted/60"
        >
          ⋯
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        {!showNotifications && !showVerification && !showParentLink && !showParentRequests ? (
          <div className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowNotifications(true)}
            >
              {tPage("notifications")}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowParentLink(true)}
            >
              {tPage("parentLink")}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowParentRequests(true)}
            >
              {tPage("parentRequests")}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowVerification(true)}
            >
              {tPage("verification")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit px-2"
              onClick={() => {
                setShowNotifications(false)
                setShowVerification(false)
                setShowParentLink(false)
                setShowParentRequests(false)
              }}
            >
              ← {tCommon("back")}
            </Button>
            {showNotifications && (
              <PageOwnerNotifications
                pageId={pageId}
                ownerId={ownerId}
                initialDaily={initialDaily}
                initialThreshold={initialThreshold}
              />
            )}
            {showVerification && (
              <PageVerificationRequest
                pageId={pageId}
                ownerId={ownerId}
                isVerified={isVerified}
              />
            )}
            {showParentLink && (
              <PageParentRequest pageId={pageId} ownerId={ownerId} />
            )}
            {showParentRequests && (
              <PageParentRequests pageId={pageId} ownerId={ownerId} />
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}