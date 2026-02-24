import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"

export const dynamic = "force-dynamic"

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
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 })
  }

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: { parentPageId?: string; childPageId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  const { parentPageId, childPageId } = body
  if (!parentPageId || !childPageId) {
    return NextResponse.json(
      { ok: false, error: "parentPageId and childPageId required" },
      { status: 400 }
    )
  }

  const { data: parentPage } = await supabase
    .from("pages")
    .select("id, owner_id")
    .eq("id", parentPageId)
    .maybeSingle()

  if (!parentPage || parentPage.owner_id !== userData.user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const { data: childPage } = await supabase
    .from("pages")
    .select("id, parent_page_id")
    .eq("id", childPageId)
    .maybeSingle()

  if (!childPage || childPage.parent_page_id !== parentPageId) {
    return NextResponse.json({ ok: false, error: "Child not linked to this parent" }, { status: 400 })
  }

  const { error } = await supabase
    .from("pages")
    .update({ parent_page_id: null })
    .eq("id", childPageId)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}