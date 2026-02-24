import { redirect } from "next/navigation"

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ next?: string; error?: string }>
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { next, error } = await searchParams
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : `/${locale}`

  const destination = new URLSearchParams()
  destination.set("auth", "login")
  destination.set("next", safeNext)
  if (error) {
    destination.set("error", error)
  }

  redirect(`/${locale}?${destination.toString()}`)
}