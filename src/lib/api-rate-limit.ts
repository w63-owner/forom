import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/private-pages-rate-limit"

type RateLimitConfig = {
  /** Max requests per window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

const DEFAULT_MUTATION_LIMIT: RateLimitConfig = {
  limit: 30,
  windowMs: 60_000,
}

const LIMITS: Record<string, RateLimitConfig> = {
  "votes/toggle": { limit: 20, windowMs: 60_000 },
  "comments/create": { limit: 10, windowMs: 60_000 },
  "comments/reply": { limit: 10, windowMs: 60_000 },
  "comments/edit": { limit: 15, windowMs: 60_000 },
  "comments/delete": { limit: 10, windowMs: 60_000 },
  "comments/vote": { limit: 30, windowMs: 60_000 },
  "pages/create": { limit: 5, windowMs: 60_000 },
  "translations": { limit: 20, windowMs: 60_000 },
}

function extractIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  const real = request.headers.get("x-real-ip")
  if (real) return real.trim()
  return "unknown"
}

/**
 * Apply rate limiting to an API mutation endpoint.
 * Returns a 429 NextResponse if the limit is exceeded, or null if the request is allowed.
 */
export function applyRateLimit(
  request: Request,
  endpointKey: string,
  userId?: string | null
): NextResponse | null {
  const config = LIMITS[endpointKey] ?? DEFAULT_MUTATION_LIMIT
  const ip = extractIp(request)
  const identifier = userId ?? `ip:${ip}`
  const key = `api:${endpointKey}:${identifier}`

  const result = checkRateLimit({
    key,
    limit: config.limit,
    windowMs: config.windowMs,
  })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
        },
      }
    )
  }

  return null
}
