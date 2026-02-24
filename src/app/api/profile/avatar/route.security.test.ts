import { describe, expect, it } from "vitest"
import { POST as updateAvatar } from "@/app/api/profile/avatar/route"

describe("profile avatar route security", () => {
  it("rejects avatar update when Origin is missing", async () => {
    const request = new Request("http://localhost:3000/api/profile/avatar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=A",
      }),
    })
    const response = await updateAvatar(request)
    expect(response.status).toBe(403)
  })
})
