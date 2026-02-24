"use client"

export type AuthModalMode = "signup" | "login"
export type AuthModalStep = "form" | "verify_code"

export const AUTH_QUERY_KEY = "auth"
export const NEXT_QUERY_KEY = "next"
export const OTP_RESEND_COOLDOWN_SECONDS = 60
export const OTP_MAX_ATTEMPTS = 5
export const OTP_EXPIRY_MINUTES = 10
export const OTP_LOCKOUT_MINUTES = 10

export function normalizeAuthMode(value: string | null | undefined): AuthModalMode | null {
  if (value === "signup" || value === "login") return value
  return null
}

export function sanitizeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return "/"
  if (value.startsWith("//")) return "/"
  return value
}

export function normalizeOtpCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8)
}

export function isOtpCodeValid(value: string): boolean {
  return /^\d{6,8}$/.test(value)
}
