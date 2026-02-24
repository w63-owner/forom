import type { MetadataRoute } from "next"
import { createClient } from "@supabase/supabase-js"
import { routing } from "@/i18n/routing"

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.startsWith("http")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://www.forom.app"

const staticPaths = [
  "",
  "/explore",
  "/discover",
  "/discover/mobilite-voyage",
  "/discover/services-publics",
  "/discover/produits-tech",
  "/discover/consommation",
  "/discover/vie-locale",
  "/discover/energie-utilities",
  "/discover/media-culture",
  "/discover/habitat-immobilier",
  "/discover/vie-professionnelle",
  "/discover/luxe-lifestyle",
  "/discover/finance-investissement",
  "/discover/innovation-lab",
  "/pages",
  "/pages/create",
  "/propositions/create",
  "/profile",
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date()
  const entries: MetadataRoute.Sitemap = []

  routing.locales.forEach((locale) => {
    staticPaths.forEach((path) => {
      entries.push({
        url: `${siteUrl}/${locale}${path}`,
        lastModified,
      })
    })
  })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return entries
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  })

  const [{ data: pages }, { data: propositions }] = await Promise.all([
    supabase.from("pages").select("slug").not("slug", "is", null).limit(5000),
    supabase.from("propositions").select("id").limit(5000),
  ])

  for (const locale of routing.locales) {
    ;(pages ?? []).forEach((page) => {
      entries.push({
        url: `${siteUrl}/${locale}/pages/${page.slug}`,
        lastModified,
      })
    })
    ;(propositions ?? []).forEach((prop) => {
      entries.push({
        url: `${siteUrl}/${locale}/propositions/${prop.id}`,
        lastModified,
      })
    })
  }

  return entries
}