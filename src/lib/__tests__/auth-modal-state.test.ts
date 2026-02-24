import { describe, expect, it } from "vitest"
import {
  OTP_EXPIRY_MINUTES,
  OTP_LOCKOUT_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  isOtpCodeValid,
  normalizeAuthMode,
  normalizeOtpCode,
  sanitizeNextPath,
} from "@/lib/security/auth-modal-state"

describe("auth modal state helpers", () => {
  it("normalizes auth mode from query values", () => {
    expect(normalizeAuthMode("signup")).toBe("signup")
    expect(normalizeAuthMode("login")).toBe("login")
    expect(normalizeAuthMode("other")).toBeNull()
    expect(normalizeAuthMode(null)).toBeNull()
  })

  it("sanitizes next path to a safe internal path", () => {
    expect(sanitizeNextPath("/fr/profile")).toBe("/fr/profile")
    expect(sanitizeNextPath("//evil.com")).toBe("/")
    expect(sanitizeNextPath("https://evil.com")).toBe("/")
    expect(sanitizeNextPath(null)).toBe("/")
  })

  it("normalizes otp code to 6 digits", () => {
    expect(normalizeOtpCode("123456")).toBe("123456")
    expect(normalizeOtpCode("12-34ab56")).toBe("123456")
    expect(normalizeOtpCode("123456789")).toBe("123456")
  })

  it("validates otp code format", () => {
    expect(isOtpCodeValid("123456")).toBe(true)
    expect(isOtpCodeValid("12345")).toBe(false)
    expect(isOtpCodeValid("abcdef")).toBe(false)
  })

  it("exposes production otp policy defaults", () => {
    expect(OTP_RESEND_COOLDOWN_SECONDS).toBe(60)
    expect(OTP_MAX_ATTEMPTS).toBe(5)
    expect(OTP_EXPIRY_MINUTES).toBe(10)
    expect(OTP_LOCKOUT_MINUTES).toBe(10)
  })
})
