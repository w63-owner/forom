type OriginValidationResult = {
  ok: boolean
  reason?: string
}

const parseOrigin = (value: string | null | undefined): string | null => {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

const getAllowedOrigins = (requestUrl: string): Set<string> => {
  const allowed = new Set<string>()
  const requestOrigin = parseOrigin(requestUrl)
  if (requestOrigin) {
    allowed.add(requestOrigin)
  }

  const appOrigin = parseOrigin(process.env.NEXT_PUBLIC_APP_URL)
  if (appOrigin) {
    allowed.add(appOrigin)
  }

  if (process.env.NODE_ENV !== "production") {
    allowed.add("http://localhost:3000")
    allowed.add("http://127.0.0.1:3000")
  }

  return allowed
}

/**
 * CSRF baseline check for mutating routes.
 * Rejects requests with missing/invalid Origin unless it matches allowed app origins.
 */
export function validateMutationOrigin(request: Request): OriginValidationResult {
  const requestOrigin = request.headers.get("origin")
  const parsedOrigin = parseOrigin(requestOrigin)
  if (!parsedOrigin) {
    return { ok: false, reason: "Missing or invalid Origin header." }
  }

  const allowedOrigins = getAllowedOrigins(request.url)
  if (!allowedOrigins.has(parsedOrigin)) {
    return { ok: false, reason: "Origin not allowed." }
  }

  return { ok: true }
}
