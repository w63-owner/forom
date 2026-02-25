import { describe, expect, it } from "vitest"
import {
  hashInvitationToken,
  isInvitationActive,
  sanitizePageMemberRole,
  sanitizeVisibility,
} from "@/lib/private-pages"

describe("private-pages utils", () => {
  it("hashes invitation token deterministically", () => {
    const token = "abc123-token"
    expect(hashInvitationToken(token)).toBe(hashInvitationToken(token))
  })

  it("validates invitation activity based on expiration and usage", () => {
    const now = new Date("2026-01-01T00:00:00.000Z")
    expect(
      isInvitationActive(
        {
          expires_at: "2026-01-01T02:00:00.000Z",
          revoked_at: null,
          max_uses: 2,
          used_count: 1,
        },
        now
      )
    ).toBe(true)
    expect(
      isInvitationActive(
        {
          expires_at: "2025-12-31T23:00:00.000Z",
          revoked_at: null,
          max_uses: null,
          used_count: 0,
        },
        now
      )
    ).toBe(false)
    expect(
      isInvitationActive(
        {
          expires_at: "2026-01-01T02:00:00.000Z",
          revoked_at: "2026-01-01T00:30:00.000Z",
          max_uses: null,
          used_count: 0,
        },
        now
      )
    ).toBe(false)
  })

  it("sanitizes visibility and member roles", () => {
    expect(sanitizeVisibility("public")).toBe("public")
    expect(sanitizeVisibility("private")).toBe("private")
    expect(sanitizeVisibility("hidden")).toBeNull()
    expect(sanitizePageMemberRole("admin")).toBe("admin")
    expect(sanitizePageMemberRole("viewer")).toBe("viewer")
    expect(sanitizePageMemberRole("owner")).toBeNull()
  })
})

