import { describe, expect, it } from "vitest"
import { validateMutationOrigin } from "@/lib/security/origin-guard"

describe("validateMutationOrigin", () => {
  it("rejects missing origin", () => {
    const request = new Request("http://localhost:3000/api/test", {
      method: "POST",
    })
    const result = validateMutationOrigin(request)
    expect(result.ok).toBe(false)
  })

  it("accepts same-origin requests", () => {
    const request = new Request("http://localhost:3000/api/test", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    })
    const result = validateMutationOrigin(request)
    expect(result.ok).toBe(true)
  })
})
