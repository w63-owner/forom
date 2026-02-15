import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const parseIds = (value: string | null): string[] => {
  if (!value) return []
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => UUID_PATTERN.test(item))
    )
  ).slice(0, 100)
}

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const ids = parseIds(searchParams.get("ids"))
  if (ids.length === 0) {
    return NextResponse.json({
      ok: true,
      votedIds: [] as string[],
      voteCountsById: {} as Record<string, number>,
    })
  }

  const { data, error } = await supabase
    .from("votes")
    .select("proposition_id, type")
    .eq("user_id", authData.user.id)
    .in("proposition_id", ids)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const votedIds = (data ?? [])
    .filter((row) => row.type === "Upvote")
    .map((row) => row.proposition_id)

  const { data: propositionRows, error: propositionError } = await supabase
    .from("propositions")
    .select("id, votes_count")
    .in("id", ids)
  if (propositionError) {
    return NextResponse.json(
      { ok: false, error: propositionError.message },
      { status: 500 }
    )
  }

  const voteCountsById = (propositionRows ?? []).reduce<Record<string, number>>(
    (acc, row) => {
      acc[row.id] = row.votes_count ?? 0
      return acc
    },
    {}
  )

  return NextResponse.json({ ok: true, votedIds, voteCountsById })
}