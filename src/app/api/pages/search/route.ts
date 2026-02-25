import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = (searchParams.get("q") ?? "").trim()
  const locale = searchParams.get("locale") === "fr" ? "fr" : "en"
  const t = (en: string, fr: string) => (locale === "fr" ? fr : en)
  if (!query) {
    return NextResponse.json({ data: [] })
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json(
      { error: t("Supabase not configured.", "Supabase non configuré.") },
      { status: 500 }
    )
  }

  const { data, error } = await supabase
    .from("pages")
    .select("id, name, slug")
    .neq("visibility", "private")
    .or(`name.ilike.%${query}%,slug.ilike.%${query}%`)
    .order("name", { ascending: true })
    .limit(5)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}