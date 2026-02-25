type LimitEntry = {
  count: number
  resetAt: number
}

const buckets = new Map<string, LimitEntry>()

function getNow() {
  return Date.now()
}

export function checkRateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string
  limit: number
  windowMs: number
}): { ok: true; remaining: number } | { ok: false; retryAfterMs: number } {
  const now = getNow()
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: Math.max(0, limit - 1) }
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterMs: Math.max(0, existing.resetAt - now) }
  }

  existing.count += 1
  buckets.set(key, existing)
  return { ok: true, remaining: Math.max(0, limit - existing.count) }
}

