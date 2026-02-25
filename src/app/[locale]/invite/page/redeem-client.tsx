"use client"

import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Props = {
  token: string
}

export default function InviteRedeemClient({ token }: Props) {
  const t = useTranslations("PrivatePages")
  const locale = useLocale()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [slug, setSlug] = useState<string | null>(null)

  useEffect(() => {
    const redeem = async () => {
      const response = await fetch("/api/pages/invitations/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean
            pageSlug?: string
            error?: string
          }
        | null
      if (!response.ok || !payload?.ok || !payload.pageSlug) {
        if (response.status === 410) {
          setError(t("inviteExpired"))
        } else if (response.status === 404) {
          setError(t("inviteNotFound"))
        } else {
          setError(payload?.error ?? t("inviteRedeemError"))
        }
        setLoading(false)
        return
      }
      setSlug(payload.pageSlug)
      setLoading(false)
    }
    void redeem()
  }, [token, t])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("inviteRedeeming")}</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (error || !slug) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("inviteFailedTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{error ?? t("inviteRedeemError")}</p>
          <Button variant="outline" onClick={() => router.push(`/${locale}`)}>
            {t("backHome")}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("inviteSuccessTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("inviteSuccessBody")}</p>
        <Button onClick={() => router.push(`/${locale}/pages/${slug}`)}>
          {t("openPrivatePage")}
        </Button>
      </CardContent>
    </Card>
  )
}

