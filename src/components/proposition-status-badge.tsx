"use client"

import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  getStatusKey,
  getStatusToneClass,
  normalizeStatus,
  STATUS_VALUES,
} from "@/lib/status-labels"

type Props = {
  propositionId: string
  initialStatus: string
  pageOwnerId: string | null
  currentUserId: string | null
  onStatusChange?: (propositionId: string, newStatus: string) => void
}

export function PropositionStatusBadge({
  propositionId,
  initialStatus,
  pageOwnerId,
  currentUserId,
  onStatusChange,
}: Props) {
  const tStatus = useTranslations("Status")
  const locale = useLocale()
  const [status, setStatus] = useState(initialStatus)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const isOwner =
    Boolean(currentUserId) && Boolean(pageOwnerId) && currentUserId === pageOwnerId

  useEffect(() => {
    setStatus(initialStatus)
  }, [initialStatus])

  const handleSelect = async (nextStatus: string) => {
    if (!isOwner) return
    if (nextStatus === status) {
      setOpen(false)
      return
    }

    const previousStatus = status
    setLoading(true)
    setStatus(nextStatus)
    setOpen(false)
    onStatusChange?.(propositionId, nextStatus)

    try {
      const response = await fetch("/api/propositions/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propositionId,
          status: nextStatus,
        }),
      })

      if (!response.ok) {
        setStatus(previousStatus)
        onStatusChange?.(propositionId, previousStatus)
        return
      }

      // Fire-and-forget notification endpoint; UI state is already updated.
      void fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: nextStatus === "Done" ? "status_done" : "status_change",
          propositionId,
          actorUserId: currentUserId ?? undefined,
          newStatus: nextStatus,
          locale,
        }),
      }).catch(() => null)
    } catch {
      setStatus(previousStatus)
      onStatusChange?.(propositionId, previousStatus)
    } finally {
      setLoading(false)
    }
  }

  if (isOwner) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Badge asChild variant="outline">
            <button
              type="button"
              disabled={loading}
              aria-label={tStatus(getStatusKey(status))}
              className={cn(
                "focus-ring min-h-[44px] w-fit cursor-pointer gap-1 transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-70",
                getStatusToneClass(status),
                open && "bg-accent"
              )}
            >
              {tStatus(getStatusKey(status))}
              <ChevronDown className="size-3 opacity-70" />
            </button>
          </Badge>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1" align="start">
          <ul className="flex flex-col gap-0.5">
            {STATUS_VALUES.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => handleSelect(option)}
                  disabled={loading}
                  className={cn(
                    "focus-ring min-h-[44px] w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                    status === option && "bg-accent font-medium"
                  )}
                >
                  {tStatus(getStatusKey(option))}
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn("w-fit", getStatusToneClass(normalizeStatus(status)))}
    >
      {tStatus(getStatusKey(normalizeStatus(status)))}
    </Badge>
  )
}