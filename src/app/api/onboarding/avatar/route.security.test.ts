import { describe, expect, it } from "vitest"
import { POST } from "@/app/api/onboarding/avatar/route"

describe("onboarding avatar route security", () => {
  it("rejects missing origin on mutating request", async () => {
    const request = new Request("http://localhost:3000/api/onboarding/avatar", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ skip: true }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })
})
