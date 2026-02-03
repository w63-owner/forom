"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getSupabaseClient } from "@/utils/supabase/client"

type Props = {
  pageId: string
}

export function PageSubscribeButton({ pageId }: Props) {
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  useEffect(() => {
    const fetchSubscription = async () => {
      const supabase = getSupabaseClient()
      if (!supabase) return
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return
      const { data } = await supabase
        .from("page_subscriptions")
        .select("page_id")
        .eq("page_id", pageId)
        .eq("user_id", userData.user.id)
        .maybeSingle()
      setSubscribed(Boolean(data))
    }
    fetchSubscription()
  }, [pageId])

  const handleSubscribe = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      window.location.href = `/login?next=/pages/${pageId}`
      return
    }
    setLoading(true)
    if (subscribed) {
      await supabase
        .from("page_subscriptions")
        .delete()
        .eq("page_id", pageId)
        .eq("user_id", userData.user.id)
      setSubscribed(false)
      setLoading(false)
      return
    }
    await supabase.from("page_subscriptions").insert({
      page_id: pageId,
      user_id: userData.user.id,
    })
    setSubscribed(true)
    setLoading(false)
    setInfoOpen(true)
  }

  return (
    <Popover open={infoOpen} onOpenChange={setInfoOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" onClick={handleSubscribe} disabled={loading}>
          {subscribed ? "Abonné" : "S'abonner"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-w-xs text-sm">
        Vous recevrez un e-mail dès que l'entreprise publiera une nouveauté ou
        réalisera une proposition.
      </PopoverContent>
    </Popover>
  )
}
