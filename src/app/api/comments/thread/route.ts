import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { createCommentsRequestTracker } from "@/lib/observability/comments-metrics"
import { loadEnrichedCommentsFlat } from "@/lib/comments/thread-loader"

export const dynamic = "force-dynamic"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const tracker = createCommentsRequestTracker("thread_read")
  const attemptHeader = request.headers.get("x-comments-attempt")
  const attempt = Number(attemptHeader)
  const retryCount = Number.isFinite(attempt) && attempt > 1 ? attempt - 1 : 0
  const timeoutHeader = request.headers.get("x-comments-timeouts")
  const timeoutCount = Number(timeoutHeader)
  const timedOut = Number.isFinite(timeoutCount) && timeoutCount > 0
  const respond = (
    body: { ok: boolean; error?: string; comments?: unknown[] },
    status: number,
    propositionId?: string | null
  ) => {
    tracker.complete({
      statusCode: status,
      propositionId,
      retries: retryCount,
      timedOut,
    })
    return NextResponse.json(body, { status })
  }

  const url = new URL(request.url)
  const propositionId = url.searchParams.get("propositionId")?.trim() ?? ""
  if (!propositionId || !UUID_PATTERN.test(propositionId)) {
    return respond({ ok: false, error: "Invalid propositionId." }, 400, null)
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return respond({ ok: false, error: "Supabase not configured." }, 500, propositionId)
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const loaded = await loadEnrichedCommentsFlat({
      supabase,
      propositionId,
      currentUserId: user?.id ?? null,
    })
    return respond({ ok: true, comments: loaded.comments }, 200, propositionId)
  } catch (error) {
    return respond(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load comments.",
      },
      500,
      propositionId
    )
  }
}
