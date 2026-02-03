"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { getSupabaseClient } from "@/utils/supabase/client"

// Bell outline (default / not subscribed)
function BellOutlineIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      focusable="false"
      aria-hidden="true"
      className={cn("h-5 w-5", className)}
    >
      <path
        d="M16 19a4 4 0 11-8 0H4.765C3.21 19 2.25 17.304 3.05 15.97l1.806-3.01A1 1 0 005 12.446V8a7 7 0 0114 0v4.446c0 .181.05.36.142.515l1.807 3.01c.8 1.333-.161 3.029-1.716 3.029H16ZM12 3a5 5 0 00-5 5v4.446a3 3 0 01-.428 1.543L4.765 17h14.468l-1.805-3.01A3 3 0 0117 12.445V8a5 5 0 00-5-5Zm-2 16a2 2 0 104 0h-4Z"
        fill="currentColor"
      />
    </svg>
  )
}

// Bell with notification (subscribed)
function BellSubscribedIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      focusable="false"
      aria-hidden="true"
      className={cn("h-5 w-5", className)}
    >
      <path
        d="M19.395 1.196a1 1 0 00-.199 1.4A9 9 0 0121 8a1 1 0 002 0 11 11 0 00-2.205-6.605 1 1 0 00-1.4-.199Zm-16.192.2A11 11 0 001 8a1 1 0 002 0 9 9 0 011.803-5.404 1 1 0 00-1.6-1.2ZM12 1a7 7 0 00-7 7v4.446a1 1 0 01-.144.515L3.05 15.972C2.25 17.305 3.21 19 4.766 19H8a4 4 0 108 0h3.233c1.555 0 2.515-1.695 1.715-3.029l-1.805-3.01a1 1 0 01-.143-.515V8a7 7 0 00-7-7Zm0 2a5 5 0 015 5v4.445a3 3 0 00.428 1.545L19.233 17H4.766l1.806-3.01c.28-.466.428-1 .428-1.544V8a5 5 0 015-5Zm-2 16h4a2 2 0 01-4 0Z"
        fill="currentColor"
      />
    </svg>
  )
}

type Props = {
  propositionId: string
  className?: string
}

export function PropositionNotifyButton({ propositionId, className }: Props) {
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchSubscription = async () => {
      const supabase = getSupabaseClient()
      if (!supabase) return
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return
      const { data } = await supabase
        .from("proposition_subscriptions")
        .select("proposition_id")
        .eq("proposition_id", propositionId)
        .eq("user_id", userData.user.id)
        .maybeSingle()
      setSubscribed(Boolean(data))
    }
    fetchSubscription()
  }, [propositionId])

  const handleClick = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      window.location.href = `/login?next=/propositions/${propositionId}`
      return
    }
    setLoading(true)
    if (subscribed) {
      await supabase
        .from("proposition_subscriptions")
        .delete()
        .eq("proposition_id", propositionId)
        .eq("user_id", userData.user.id)
      setSubscribed(false)
    } else {
      await supabase.from("proposition_subscriptions").insert({
        proposition_id: propositionId,
        user_id: userData.user.id,
      })
      setSubscribed(true)
    }
    setLoading(false)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title={
        subscribed
          ? "Ne plus être notifié des changements"
          : "Être notifié quand cette proposition change d'état (open, done…)"
      }
      aria-label={
        subscribed
          ? "Ne plus être notifié"
          : "Activer les notifications pour cette proposition"
      }
      className={cn(
        "inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50",
        className
      )}
    >
      {subscribed ? (
        <BellSubscribedIcon className="text-foreground" />
      ) : (
        <BellOutlineIcon />
      )}
    </button>
  )
}
