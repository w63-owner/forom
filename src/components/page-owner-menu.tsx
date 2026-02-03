"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PageOwnerNotifications } from "@/components/page-owner-notifications"
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
  const [showNotifications, setShowNotifications] = useState(false)
  const [showVerification, setShowVerification] = useState(false)

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
        {!showNotifications && !showVerification ? (
          <div className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowNotifications(true)}
            >
              Notifications
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowVerification(true)}
            >
              Vérification
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
              }}
            >
              ← Retour
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
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
