import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"

function sanitizeQuery(value: string) {
  return value.replace(/[%_]/g, "\\$&")
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim()
  if (!q) {
    return NextResponse.json({ propositions: [], pages: [] })
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    )
  }

  const safeQuery = sanitizeQuery(q)
  const [propositionsRes, pagesRes] = await Promise.all([
    supabase
      .from("propositions")
      .select("id, title, status, votes_count, pages(name)")
      .or(`title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`)
      .or("page_id.is.null,pages.visibility.neq.private")
      .order("votes_count", { ascending: false })
      .limit(8),
    supabase
      .from("pages")
      .select("id, name, slug, is_verified, certification_type")
      .neq("visibility", "private")
      .ilike("name", `%${safeQuery}%`)
      .order("name", { ascending: true })
      .limit(6),
  ])

  if (propositionsRes.error || pagesRes.error) {
    return NextResponse.json(
      {
        error:
          propositionsRes.error?.message ?? pagesRes.error?.message ?? "Search error",
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    propositions: propositionsRes.data ?? [],
    pages: pagesRes.data ?? [],
  })
}