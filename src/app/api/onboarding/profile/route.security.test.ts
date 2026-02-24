import { describe, expect, it } from "vitest"
import { POST } from "@/app/api/onboarding/profile/route"

describe("onboarding profile route security", () => {
  it("rejects missing origin on mutating request", async () => {
    const request = new Request("http://localhost:3000/api/onboarding/profile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fullName: "Antonin Fourcade",
        username: "antonin",
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })
})
