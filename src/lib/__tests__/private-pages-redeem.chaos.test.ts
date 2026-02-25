import { describe, expect, it } from "vitest"
import { checkRateLimit } from "@/lib/private-pages-rate-limit"

describe("private-pages redeem chaos", () => {
  it("blocks repeated abuse by same key", () => {
    const key = `chaos:${Math.random()}`
    const outcomes = Array.from({ length: 6 }, () =>
      checkRateLimit({ key, limit: 3, windowMs: 60_000 })
    )
    const denied = outcomes.filter((result) => !result.ok)
    expect(denied.length).toBeGreaterThan(0)
  })
})

