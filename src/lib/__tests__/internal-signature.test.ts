import { describe, expect, it } from "vitest"
import {
  createInternalRequestSignature,
  verifyInternalRequestSignature,
} from "@/lib/security/internal-signature"

describe("internal signature", () => {
  it("validates a correct signature", () => {
    const payload = JSON.stringify({ type: "page_parent_request" })
    const timestamp = Date.now().toString()
    const secret = "test-secret"
    const signature = createInternalRequestSignature({
      payload,
      timestamp,
      secret,
    })
    const result = verifyInternalRequestSignature({
      payload,
      signature,
      timestamp,
      secret,
      required: true,
    })
    expect(result.ok).toBe(true)
  })

  it("rejects missing headers when required", () => {
    const result = verifyInternalRequestSignature({
      payload: "{}",
      signature: null,
      timestamp: null,
      secret: "test-secret",
      required: true,
    })
    expect(result.ok).toBe(false)
  })
})
