import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"
import { canUseSeedPagesEndpoint } from "@/lib/security/seed-pages-access"

export const dynamic = "force-dynamic"

const featuredPages = [
  { name: "France", slug: "france", category: "country" },
  { name: "Spotify", slug: "spotify", category: "brand" },
  { name: "Airbnb", slug: "airbnb", category: "brand" },
  { name: "BlaBlaCar", slug: "blablacar", category: "brand" },
  { name: "Decathlon", slug: "decathlon", category: "brand" },
  { name: "Orange", slug: "orange", category: "brand" },
  { name: "Doctolib", slug: "doctolib", category: "brand" },
  { name: "BackMarket", slug: "backmarket", category: "brand" },
  { name: "Vinted", slug: "vinted", category: "brand" },
  { name: "Leboncoin", slug: "leboncoin", category: "brand" },
  { name: "Leroy Merlin", slug: "leroy-merlin", category: "brand" },
  { name: "Carrefour", slug: "carrefour", category: "brand" },
  { name: "SNCF", slug: "sncf", category: "brand" },
  { name: "Uber", slug: "uber", category: "brand" },
  { name: "Amazon", slug: "amazon", category: "brand" },
  { name: "Apple", slug: "apple", category: "brand" },
  { name: "Google", slug: "google", category: "brand" },
  { name: "Meta", slug: "meta", category: "brand" },
  { name: "Microsoft", slug: "microsoft", category: "brand" },
  { name: "Netflix", slug: "netflix", category: "brand" },
]

export async function POST(request: Request) {
  const originValidation = validateMutationOrigin(request)
  if (!originValidation.ok) {
    return NextResponse.json(
      { ok: false, error: originValidation.reason ?? "Forbidden origin." },
      { status: 403 }
    )
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const isAllowed = canUseSeedPagesEndpoint({
    userId: userData.user.id,
    nodeEnv: process.env.NODE_ENV,
    adminUserIdsEnv: process.env.SEED_PAGES_ADMIN_USER_IDS,
  })
  if (!isAllowed) {
    return NextResponse.json(
      { ok: false, error: "Forbidden: admin only in production." },
      { status: 403 }
    )
  }

  const payload = featuredPages.map((page) => ({
    owner_id: userData.user.id,
    name: page.name,
    slug: page.slug,
    description: `Page ${page.name}`,
    category: page.category,
    certification_type: "NONE",
    is_verified: false,
  }))

  const { error } = await supabase
    .from("pages")
    .upsert(payload, { onConflict: "slug" })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}