import { describe, expect, it } from "vitest"
import { getUniformEmailCheckTransition } from "@/lib/security/auth-enumeration"

describe("anti-enumeration login transition", () => {
  it("always returns the same next step and message key", () => {
    const result = getUniformEmailCheckTransition()
    expect(result.nextStep).toBe("signin")
    expect(result.messageKey).toBe("verifyAccountFallback")
  })
})
