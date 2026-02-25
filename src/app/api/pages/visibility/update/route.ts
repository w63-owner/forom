import { NextResponse } from "next/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"
import { sanitizeVisibility } from "@/lib/private-pages"
import { getSupabaseServerClient } from "@/utils/supabase/server"

export const dynamic = "force-dynamic"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Body = {
  pageId?: string
  visibility?: "public" | "private"
}

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
    return NextResponse.json({ ok: false, error: "Supabase not configured." }, { status: 500 })
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 })
  }

  const pageId = body.pageId?.trim() ?? ""
  const visibility = sanitizeVisibility(body.visibility)
  if (!UUID_PATTERN.test(pageId) || !visibility) {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 })
  }

  const { data: page } = await supabase
    .from("pages")
    .select("id, owner_id, visibility")
    .eq("id", pageId)
    .maybeSingle()

  if (!page || page.owner_id !== authData.user.id) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 })
  }

  if (page.visibility === visibility) {
    return NextResponse.json({ ok: true, visibility })
  }

  const { error } = await supabase
    .from("pages")
    .update({ visibility })
    .eq("id", pageId)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, visibility })
}

