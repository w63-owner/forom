"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { getSupabaseClient } from "@/utils/supabase/client"

type Props = {
  propositionId: string
  authorId: string | null
  className?: string
}

export function PropositionEditLink({
  propositionId,
  authorId,
  className = "",
}: Props) {
  const [isAuthor, setIsAuthor] = useState(false)

  useEffect(() => {
    const check = async () => {
      if (!authorId) {
        setIsAuthor(false)
        return
      }
      const supabase = getSupabaseClient()
      if (!supabase) return
      const { data } = await supabase.auth.getUser()
      setIsAuthor(Boolean(data.user?.id === authorId))
    }
    check()
  }, [authorId])

  if (!isAuthor) return null

  return (
    <Link
      href={`/propositions/${propositionId}/edit`}
      className={`link-nav inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors transition-transform duration-150 hover:bg-muted hover:text-foreground active:scale-95 ${className}`}
    >
      Modifier
    </Link>
  )
}
