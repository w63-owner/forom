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
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"
import { cn } from "@/lib/utils"
import { getStatusKey, STATUS_VALUES } from "@/lib/status-labels"

type Props = {
  propositionId: string
  initialStatus: string
  pageOwnerId: string | null
  onStatusChange?: (propositionId: string, newStatus: string) => void
}

export function PropositionStatusBadge({
  propositionId,
  initialStatus,
  pageOwnerId,
  onStatusChange,
}: Props) {
  const tStatus = useTranslations("Status")
  const locale = useLocale()
  const [status, setStatus] = useState(initialStatus)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const isOwner =
    Boolean(currentUserId) && Boolean(pageOwnerId) && currentUserId === pageOwnerId

  useEffect(() => {
    const loadCurrentUser = async () => {
      const supabase = getSupabaseClient()
      if (!supabase) return
      const user = await resolveAuthUser(supabase, {
        timeoutMs: 3500,
        includeServerFallback: true,
      })
      setCurrentUserId(user?.id ?? null)
    }
    void loadCurrentUser()
  }, [])

  const handleSelect = async (nextStatus: string) => {
    if (!isOwner) return
    const supabase = getSupabaseClient()
    if (!supabase) return
    setLoading(true)
    const { error } = await supabase
      .from("propositions")
      .update({ status: nextStatus })
      .eq("id", propositionId)
    if (!error) {
      setStatus(nextStatus)
      setOpen(false)
      onStatusChange?.(propositionId, nextStatus)
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: nextStatus === "Done" ? "status_done" : "status_change",
          propositionId,
          actorUserId: (
            await resolveAuthUser(supabase, {
              timeoutMs: 3500,
              includeServerFallback: true,
            })
          )?.id,
          newStatus: nextStatus,
          locale,
        }),
      }).catch(() => null)
    }
    setLoading(false)
  }

  if (isOwner) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "w-fit cursor-pointer gap-1 transition-colors hover:bg-accent",
              open && "bg-accent"
            )}
          >
            {tStatus(getStatusKey(status))}
            <ChevronDown className="size-3 opacity-70" />
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
                    "w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
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
    <Badge variant="outline" className="w-fit">
      {tStatus(getStatusKey(status))}
    </Badge>
  )
}