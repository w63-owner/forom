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
      .select("id, title, status, votes_count, page_id, pages(name, visibility)")
      .or(`title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`)
      .order("votes_count", { ascending: false })
      .limit(20),
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

  type PropositionRow = {
    id: string
    title: string
    status: string
    votes_count: number
    page_id: string | null
    pages: { name: string; visibility: string } | null
  }

  const propositions = ((propositionsRes.data ?? []) as PropositionRow[])
    .filter((p) => !p.page_id || p.pages?.visibility !== "private")
    .slice(0, 8)
    .map(({ page_id: _pid, ...rest }) => ({
      ...rest,
      pages: rest.pages ? { name: rest.pages.name } : null,
    }))

  return NextResponse.json({
    propositions,
    pages: pagesRes.data ?? [],
  })
}