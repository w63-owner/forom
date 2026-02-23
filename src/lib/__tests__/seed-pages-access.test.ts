import { describe, expect, it } from "vitest"
import { canUseSeedPagesEndpoint } from "@/lib/security/seed-pages-access"

describe("seed-pages access policy", () => {
  it("allows in non-production", () => {
    expect(
      canUseSeedPagesEndpoint({
        userId: "user-1",
        nodeEnv: "development",
        adminUserIdsEnv: "",
      })
    ).toBe(true)
  })

  it("blocks non-admin users in production", () => {
    expect(
      canUseSeedPagesEndpoint({
        userId: "user-2",
        nodeEnv: "production",
        adminUserIdsEnv: "user-1,user-3",
      })
    ).toBe(false)
  })
})
