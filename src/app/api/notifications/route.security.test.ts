import { describe, expect, it } from "vitest"
import { POST, validateNotificationAuthorization } from "@/app/api/notifications/route"

describe("notifications route security", () => {
  it("rejects POST when internal signature is required but missing", async () => {
    process.env.INTERNAL_API_SIGNING_SECRET = "test-secret"
    process.env.INTERNAL_API_SIGNING_REQUIRED = "true"

    const request = new Request("http://localhost:3000/api/notifications", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({ type: "comment_created" }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it("rejects actor spoofing before touching resources", async () => {
    const result = await validateNotificationAuthorization({
      // Actor mismatch is validated before DB access.
      supabase: {} as never,
      payload: {
        type: "owner_vote_threshold",
        propositionId: "prop-1",
        actorUserId: "attacker-id",
      },
      authenticatedUserId: "real-user-id",
      proposition: null,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("Forbidden actorUserId")
    }
  })
})
