import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"
import { applyRateLimit } from "@/lib/api-rate-limit"

export const dynamic = "force-dynamic"

type ToggleVoteBody = { propositionId?: string }

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
      { ok: false, error: "Supabase not configured." },
      { status: 500 }
    )
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 }
    )
  }

  const rateLimited = applyRateLimit(request, "votes/toggle", authData.user.id)
  if (rateLimited) return rateLimited

  let body: ToggleVoteBody
  try {
    body = (await request.json()) as ToggleVoteBody
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    )
  }

  const propositionId = body.propositionId?.trim()
  if (!propositionId) {
    return NextResponse.json(
      { ok: false, error: "propositionId is required." },
      { status: 400 }
    )
  }
  if (!UUID_PATTERN.test(propositionId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid propositionId format." },
      { status: 400 }
    )
  }

  const userId = authData.user.id

  // Atomic toggle via RPC (avoids race between read and write)
  const { data, error } = await supabase.rpc("toggle_vote", {
    p_proposition_id: propositionId,
    p_user_id: userId,
  })

  if (error) {
    if (error.code === "P0001" || error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }

  const rows = (data ?? []) as Array<{
    new_vote_count?: number
    has_voted?: boolean
  }>
  const row = rows[0]
  const newVoteCount =
    typeof row?.new_vote_count === "number" ? row.new_vote_count : 0
  const hasVoted = Boolean(row?.has_voted)

  return NextResponse.json({
    ok: true,
    hasVoted,
    votes: newVoteCount,
  })
}