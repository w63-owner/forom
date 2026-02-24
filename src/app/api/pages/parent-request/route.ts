import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"

export const dynamic = "force-dynamic"

const getSupabaseAdminClient = (): SupabaseClient | null => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } })
}

type CreateRequestBody = {
  parentPageId?: string
  childPageId?: string
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
    return NextResponse.json(
      { ok: false, error: "Supabase not configured" },
      { status: 500 }
    )
  }

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: CreateRequestBody
  try {
    body = (await request.json()) as CreateRequestBody
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  const parentPageId = body.parentPageId?.trim()
  const childPageId = body.childPageId?.trim()
  if (!parentPageId || !childPageId) {
    return NextResponse.json(
      { ok: false, error: "parentPageId and childPageId are required" },
      { status: 400 }
    )
  }
  if (parentPageId === childPageId) {
    return NextResponse.json(
      { ok: false, error: "A page cannot be its own parent" },
      { status: 400 }
    )
  }

  const [{ data: parentPage }, { data: childPage }] = await Promise.all([
    supabase
      .from("pages")
      .select("id, owner_id")
      .eq("id", parentPageId)
      .maybeSingle(),
    supabase
      .from("pages")
      .select("id, owner_id, parent_page_id")
      .eq("id", childPageId)
      .maybeSingle(),
  ])

  if (!parentPage || !childPage) {
    return NextResponse.json({ ok: false, error: "Page not found" }, { status: 404 })
  }
  if (childPage.parent_page_id === parentPageId) {
    return NextResponse.json(
      { ok: false, error: "This page is already linked as a sub-page" },
      { status: 409 }
    )
  }

  const userId = userData.user.id
  const isParentOwner = parentPage.owner_id === userId
  const isChildOwner = childPage.owner_id === userId
  if (!isParentOwner && !isChildOwner) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const db = getSupabaseAdminClient() ?? supabase
  const { data: requestRow, error: requestError } = await db
    .from("page_parent_requests")
    .upsert(
      {
        child_page_id: childPageId,
        parent_page_id: parentPageId,
        requested_by: userId,
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
      },
      { onConflict: "child_page_id" }
    )
    .select("id")
    .maybeSingle()

  if (requestError) {
    return NextResponse.json({ ok: false, error: requestError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    requestId: requestRow?.id ?? null,
  })
}
