import { NextResponse } from "next/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"
import { STATUS_VALUES } from "@/lib/status-labels"
import { getSupabaseServerClient } from "@/utils/supabase/server"

type UpdateStatusBody = {
  propositionId?: string
  status?: string
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

  let body: UpdateStatusBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  const propositionId = body.propositionId?.trim()
  const nextStatus = body.status

  if (!propositionId || !nextStatus) {
    return NextResponse.json(
      { ok: false, error: "propositionId and status are required" },
      { status: 400 }
    )
  }

  if (!STATUS_VALUES.includes(nextStatus as (typeof STATUS_VALUES)[number])) {
    return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("propositions")
    .update({ status: nextStatus })
    .eq("id", propositionId)
    .select("id, status")
    .limit(1)

  if (error) {
    const status = error.code === "42501" ? 403 : 400
    return NextResponse.json({ ok: false, error: error.message }, { status })
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Forbidden or proposition not found" },
      { status: 403 }
    )
  }

  return NextResponse.json({ ok: true, status: data[0].status })
}
