import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"

export const dynamic = "force-dynamic"

const getSupabaseAdminClient = (): SupabaseClient | null => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    return null
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
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
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    )
  }

  const { requestId } = await params
  if (!requestId) {
    return NextResponse.json(
      { ok: false, error: "requestId required" },
      { status: 400 }
    )
  }

  let body: { status?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    )
  }

  const status = body.status === "approved" || body.status === "rejected"
    ? body.status
    : null
  if (!status) {
    return NextResponse.json(
      { ok: false, error: "status must be 'approved' or 'rejected'" },
      { status: 400 }
    )
  }

  const admin = getSupabaseAdminClient()
  const db = admin ?? supabase

  const { data: req, error: fetchError } = await db
    .from("page_parent_requests")
    .select("id, parent_page_id, child_page_id, status")
    .eq("id", requestId)
    .maybeSingle()

  if (fetchError || !req) {
    return NextResponse.json(
      { ok: false, error: "Request not found" },
      { status: 404 }
    )
  }

  if (req.status !== "pending") {
    if (req.status === "approved" && status === "approved") {
      // Idempotent repair path: if request is already approved but link was not applied,
      // force child -> parent relation.
      const { error: relinkError } = await db
        .from("pages")
        .update({ parent_page_id: req.parent_page_id })
        .eq("id", req.child_page_id)
      if (relinkError) {
        return NextResponse.json(
          { ok: false, error: relinkError.message },
          { status: 500 }
        )
      }
      return NextResponse.json({ ok: true, repaired: true })
    }
    return NextResponse.json(
      { ok: false, error: "Request already reviewed" },
      { status: 400 }
    )
  }

  const [{ data: parentPage }, { data: childPage }] = await Promise.all([
    supabase
      .from("pages")
      .select("id, owner_id")
      .eq("id", req.parent_page_id)
      .maybeSingle(),
    supabase
      .from("pages")
      .select("id, owner_id")
      .eq("id", req.child_page_id)
      .maybeSingle(),
  ])

  const isParentOwner = parentPage?.owner_id === userData.user.id
  const isChildOwner = childPage?.owner_id === userData.user.id
  if (!isParentOwner && !isChildOwner) {
    return NextResponse.json(
      { ok: false, error: "Forbidden: not a page owner for this request" },
      { status: 403 }
    )
  }

  const { error: updateError } = await db
    .from("page_parent_requests")
    .update({
      status,
      reviewed_by: userData.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)

  if (updateError) {
    return NextResponse.json(
      { ok: false, error: updateError.message },
      { status: 500 }
    )
  }

  if (status === "approved") {
    const { error: linkError } = await db
      .from("pages")
      .update({ parent_page_id: req.parent_page_id })
      .eq("id", req.child_page_id)
    if (linkError) {
      return NextResponse.json(
        { ok: false, error: linkError.message },
        { status: 500 }
      )
    }
  } else {
    const { error: unlinkError } = await db
      .from("pages")
      .update({ parent_page_id: null })
      .eq("id", req.child_page_id)
      .eq("parent_page_id", req.parent_page_id)
    if (unlinkError) {
      return NextResponse.json(
        { ok: false, error: unlinkError.message },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ ok: true })
}