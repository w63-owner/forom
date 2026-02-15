"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"

type Props = {
  propositionId: string
  authorId: string | null
  className?: string
}

export function PropositionDeleteButton({
  propositionId,
  authorId,
  className,
}: Props) {
  const router = useRouter()
  const t = useTranslations("PropositionActions")
  const { showToast } = useToast()
  const [isAuthor, setIsAuthor] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const checkAuthor = async () => {
      const supabase = getSupabaseClient()
      if (!supabase) return
      const user = await resolveAuthUser(supabase, {
        timeoutMs: 3500,
        includeServerFallback: true,
      })
      setIsAuthor(Boolean(authorId && user?.id === authorId))
    }
    void checkAuthor()
  }, [authorId])

  if (!isAuthor) return null

  const handleDelete = async () => {
    if (loading) return
    if (!window.confirm(t("deleteConfirm"))) return
    const supabase = getSupabaseClient()
    if (!supabase) return
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (!user || user.id !== authorId) return
    setLoading(true)
    const { error } = await supabase
      .from("propositions")
      .delete()
      .eq("id", propositionId)
      .eq("author_id", user.id)
    if (error) {
      showToast({
        variant: "error",
        title: t("deleteError"),
        description: error.message,
      })
      setLoading(false)
      return
    }
    showToast({ variant: "success", title: t("deleteSuccess") })
    setTimeout(() => {
      router.push("/profile?view=mes-propositions")
    }, 150)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={handleDelete}
      disabled={loading}
    >
      {t("delete")}
    </Button>
  )
}