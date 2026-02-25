import { createHash, randomBytes, timingSafeEqual } from "crypto"

export const PRIVATE_PAGE_VISIBILITIES = ["public", "private"] as const
export type PrivatePageVisibility = (typeof PRIVATE_PAGE_VISIBILITIES)[number]

export const PAGE_MEMBER_ROLES = ["admin", "viewer"] as const
export type PageMemberRole = (typeof PAGE_MEMBER_ROLES)[number]

export type InvitationRecord = {
  expires_at: string
  revoked_at: string | null
  max_uses: number | null
  used_count: number
}

export function createInvitationToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url")
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function isInvitationActive(record: InvitationRecord, now = new Date()): boolean {
  if (record.revoked_at) return false
  const expiresAt = new Date(record.expires_at)
  if (Number.isNaN(expiresAt.getTime())) return false
  if (expiresAt.getTime() <= now.getTime()) return false
  if (record.max_uses !== null && record.used_count >= record.max_uses) return false
  return true
}

export function sanitizeVisibility(value: unknown): PrivatePageVisibility | null {
  if (value === "public" || value === "private") return value
  return null
}

export function sanitizePageMemberRole(value: unknown): PageMemberRole | null {
  if (value === "admin" || value === "viewer") return value
  return null
}

export function secureTokenEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

