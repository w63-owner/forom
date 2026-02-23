import { describe, expect, it } from "vitest"
import { POST } from "@/app/api/seed-pages/route"

describe("seed-pages security", () => {
  it("rejects missing origin on mutating request", async () => {
    const request = new Request("http://localhost:3000/api/seed-pages", {
      method: "POST",
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })
})
