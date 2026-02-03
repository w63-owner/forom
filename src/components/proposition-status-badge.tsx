"use client"

import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { getSupabaseClient } from "@/utils/supabase/client"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS = ["Open", "In Progress", "Done", "Won't Do"] as const

type Props = {
  propositionId: string
  initialStatus: string
  pageOwnerId: string | null
}

export function PropositionStatusBadge({
  propositionId,
  initialStatus,
  pageOwnerId,
}: Props) {
  const [status, setStatus] = useState(initialStatus)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const isOwner =
    Boolean(currentUserId) && Boolean(pageOwnerId) && currentUserId === pageOwnerId

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data: session }) => {
      setCurrentUserId(session.user?.id ?? null)
    })
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
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: nextStatus === "Done" ? "status_done" : "status_change",
          propositionId,
          actorUserId: (await supabase.auth.getUser()).data.user?.id,
          newStatus: nextStatus,
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
            {status}
            <ChevronDown className="size-3 opacity-70" />
          </Badge>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1" align="start">
          <ul className="flex flex-col gap-0.5">
            {STATUS_OPTIONS.map((option) => (
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
                  {option}
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
      {status}
    </Badge>
  )
}
