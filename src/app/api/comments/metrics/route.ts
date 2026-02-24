import { NextResponse } from "next/server"
import {
  INTERNAL_SIGNATURE_HEADER,
  INTERNAL_TIMESTAMP_HEADER,
  verifyInternalRequestSignature,
} from "@/lib/security/internal-signature"
import { getCommentsMetricsSnapshot } from "@/lib/observability/comments-metrics"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const secret = process.env.INTERNAL_API_SIGNING_SECRET
  const isProd = process.env.NODE_ENV === "production"

  if (isProd && secret) {
    const verification = verifyInternalRequestSignature({
      payload: "",
      signature: request.headers.get(INTERNAL_SIGNATURE_HEADER),
      timestamp: request.headers.get(INTERNAL_TIMESTAMP_HEADER),
      secret,
      required: true,
    })
    if (!verification.ok) {
      return NextResponse.json(
        { ok: false, error: verification.reason ?? "Invalid internal signature." },
        { status: 403 }
      )
    }
  }

  return NextResponse.json({
    ok: true,
    metrics: getCommentsMetricsSnapshot(),
  })
}
