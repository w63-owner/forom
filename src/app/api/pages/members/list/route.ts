import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"

export const dynamic = "force-dynamic"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured." }, { status: 500 })
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const pageId = searchParams.get("pageId")?.trim() ?? ""
  if (!UUID_PATTERN.test(pageId)) {
    return NextResponse.json({ ok: false, error: "Invalid pageId." }, { status: 400 })
  }

  const { data: page } = await supabase
    .from("pages")
    .select("id, owner_id")
    .eq("id", pageId)
    .maybeSingle()

  if (!page || page.owner_id !== authData.user.id) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("page_members")
    .select("user_id, role, created_at, users!page_members_user_id_fkey(username, email, avatar_url)")
    .eq("page_id", pageId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, members: data ?? [] })
}

