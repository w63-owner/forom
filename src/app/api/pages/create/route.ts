import { NextResponse } from "next/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"
import { sanitizeVisibility } from "@/lib/private-pages"
import { getSupabaseServerClient, resolveServerSessionUserWithRetry } from "@/utils/supabase/server"
import { applyRateLimit } from "@/lib/api-rate-limit"

export const dynamic = "force-dynamic"

type Body = {
  name?: string
  description?: string | null
  category?: string | null
  visibility?: "public" | "private"
  parentPageId?: string | null
  isRepresentative?: boolean
  verificationMethod?: string | null
  verificationProof?: string | null
  verificationNote?: string | null
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const originValidation = validateMutationOrigin(request)
  if (!originValidation.ok) {
    return NextResponse.json(
      { ok: false, code: "forbidden_origin", error: originValidation.reason ?? "Forbidden origin." },
      { status: 403 }
    )
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json(
      { ok: false, code: "supabase_not_configured", error: "Supabase not configured." },
      { status: 500 }
    )
  }

  const auth = await resolveServerSessionUserWithRetry(supabase)
  if (!auth.user) {
    return NextResponse.json(
      { ok: false, code: "unauthorized", error: auth.reason ?? "Unauthorized." },
      { status: 401 }
    )
  }

  const rateLimited = applyRateLimit(request, "pages/create", auth.user.id)
  if (rateLimited) return rateLimited

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json(
      { ok: false, code: "invalid_json", error: "Invalid JSON body." },
      { status: 400 }
    )
  }

  const name = body.name?.trim() ?? ""
  const description = body.description?.trim() || null
  const category = body.category?.trim() || null
  const visibility = sanitizeVisibility(body.visibility)
  const parentPageId = body.parentPageId?.trim() || null
  const isRepresentative = body.isRepresentative === true
  const verificationMethod = body.verificationMethod?.trim() || null
  const verificationProof = body.verificationProof?.trim() || null
  const verificationNote = body.verificationNote?.trim() || null

  if (!name || !visibility) {
    return NextResponse.json(
      { ok: false, code: "invalid_payload", error: "name and visibility are required." },
      { status: 400 }
    )
  }
  if (name.length > 255) {
    return NextResponse.json(
      { ok: false, code: "invalid_payload", error: "name must be 255 characters or less." },
      { status: 400 }
    )
  }
  if (parentPageId && !UUID_PATTERN.test(parentPageId)) {
    return NextResponse.json(
      { ok: false, code: "invalid_payload", error: "Invalid parentPageId." },
      { status: 400 }
    )
  }
  if (isRepresentative && !verificationProof) {
    return NextResponse.json(
      { ok: false, code: "verification_proof_required", error: "Verification proof is required." },
      { status: 400 }
    )
  }

  const { data: page, error: pageError } = await supabase
    .from("pages")
    .insert({
      owner_id: auth.user.id,
      name,
      description,
      category,
      visibility,
      certification_type: "NONE",
      is_verified: false,
    })
    .select("id, slug")
    .single()

  if (pageError || !page) {
    if (pageError?.code === "42501") {
      return NextResponse.json(
        { ok: false, code: "permission_denied", error: pageError.message },
        { status: 403 }
      )
    }
    if (pageError?.code === "23505" || pageError?.message?.includes("pages_slug_unique")) {
      return NextResponse.json(
        { ok: false, code: "duplicate_slug", error: pageError?.message ?? "Duplicate page slug." },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { ok: false, code: "create_failed", error: pageError?.message ?? "Unable to create page." },
      { status: 500 }
    )
  }

  let parentRequestCreated = false
  if (parentPageId) {
    const { error: parentError } = await supabase.from("page_parent_requests").upsert(
      {
        child_page_id: page.id,
        parent_page_id: parentPageId,
        requested_by: auth.user.id,
      },
      { onConflict: "child_page_id" }
    )
    parentRequestCreated = !parentError
  }

  let verificationRequested = false
  if (isRepresentative && verificationMethod && verificationProof) {
    const { error: verificationError } = await supabase.from("page_verification_requests").insert({
      page_id: page.id,
      requested_by: auth.user.id,
      method: verificationMethod,
      proof: verificationProof,
      requester_note: verificationNote,
    })
    verificationRequested = !verificationError
  }

  return NextResponse.json({
    ok: true,
    page,
    actorUserId: auth.user.id,
    parentRequestCreated,
    verificationRequested,
  })
}
