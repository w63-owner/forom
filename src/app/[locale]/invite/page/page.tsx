import { redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getServerSessionUser } from "@/utils/supabase/server"
import InviteRedeemClient from "./redeem-client"

type Props = {
  searchParams?: Promise<{ token?: string }>
}

export default async function InvitePage({ searchParams }: Props) {
  const locale = await getLocale()
  const t = await getTranslations("PrivatePages")
  const token = ((await searchParams)?.token ?? "").trim()
  const user = await getServerSessionUser()

  if (!token) {
    return (
      <div className="min-h-screen bg-muted/40 px-6 py-16">
        <div className="mx-auto w-full max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle>{t("inviteInvalidTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {t("inviteInvalidBody")}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!user) {
    const nextPath = `/${locale}/invite/page?token=${encodeURIComponent(token)}`
    redirect(`/${locale}/login?next=${encodeURIComponent(nextPath)}&auth=signup`)
  }

  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto w-full max-w-xl">
        <InviteRedeemClient token={token} />
      </div>
    </div>
  )
}

