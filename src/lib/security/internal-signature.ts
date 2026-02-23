import { createHmac, timingSafeEqual } from "node:crypto"

export const INTERNAL_SIGNATURE_HEADER = "x-forom-signature"
export const INTERNAL_TIMESTAMP_HEADER = "x-forom-timestamp"

type SignatureVerificationInput = {
  payload: string
  signature: string | null
  timestamp: string | null
  secret: string | null | undefined
  required: boolean
  nowMs?: number
  maxSkewMs?: number
}

type SignatureVerificationResult = {
  ok: boolean
  reason?: string
}

const buildDigest = (secret: string, timestamp: string, payload: string): string =>
  createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")

export function createInternalRequestSignature(args: {
  payload: string
  timestamp: string
  secret: string
}): string {
  return buildDigest(args.secret, args.timestamp, args.payload)
}

export function verifyInternalRequestSignature(
  args: SignatureVerificationInput
): SignatureVerificationResult {
  const {
    payload,
    signature,
    timestamp,
    secret,
    required,
    nowMs = Date.now(),
    maxSkewMs = 5 * 60 * 1000,
  } = args

  if (!secret) {
    // Signature verification disabled when no secret is configured.
    return { ok: true }
  }

  if (!signature || !timestamp) {
    return required
      ? { ok: false, reason: "Missing internal signature headers." }
      : { ok: true }
  }

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: "Invalid signature timestamp." }
  }

  if (Math.abs(nowMs - ts) > maxSkewMs) {
    return { ok: false, reason: "Expired signature timestamp." }
  }

  const expected = buildDigest(secret, timestamp, payload)
  const providedBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (providedBuffer.length !== expectedBuffer.length) {
    return { ok: false, reason: "Invalid internal signature." }
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return { ok: false, reason: "Invalid internal signature." }
  }

  return { ok: true }
}
