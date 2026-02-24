import { describe, expect, it } from "vitest"
import { POST as createParentRequest } from "@/app/api/pages/parent-request/route"

describe("parent request route security", () => {
  it("rejects request when Origin is missing", async () => {
    const request = new Request("http://localhost:3000/api/pages/parent-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        parentPageId: "11111111-1111-4111-8111-111111111111",
        childPageId: "22222222-2222-4222-8222-222222222222",
      }),
    })
    const response = await createParentRequest(request)
    expect(response.status).toBe(403)
  })
})
