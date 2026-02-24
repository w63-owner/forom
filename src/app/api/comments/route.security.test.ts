import { describe, expect, it } from "vitest"
import { POST as createComment } from "@/app/api/comments/create/route"
import { POST as createReply } from "@/app/api/comments/reply/route"
import { POST as voteComment } from "@/app/api/comments/vote/route"
import { POST as toggleSolution } from "@/app/api/comments/solution/route"

describe("comments routes security", () => {
  it("rejects create comment when Origin is missing", async () => {
    const request = new Request("http://localhost:3000/api/comments/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propositionId: "11111111-1111-4111-8111-111111111111",
        content: "hello",
      }),
    })
    const response = await createComment(request)
    expect(response.status).toBe(403)
  })

  it("rejects reply when Origin is missing", async () => {
    const request = new Request("http://localhost:3000/api/comments/reply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propositionId: "11111111-1111-4111-8111-111111111111",
        parentId: "22222222-2222-4222-8222-222222222222",
        content: "hello",
      }),
    })
    const response = await createReply(request)
    expect(response.status).toBe(403)
  })

  it("rejects vote when Origin is missing", async () => {
    const request = new Request("http://localhost:3000/api/comments/vote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        commentId: "22222222-2222-4222-8222-222222222222",
        type: "Upvote",
        currentVote: null,
      }),
    })
    const response = await voteComment(request)
    expect(response.status).toBe(403)
  })

  it("rejects solution toggle when Origin is missing", async () => {
    const request = new Request("http://localhost:3000/api/comments/solution", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propositionId: "11111111-1111-4111-8111-111111111111",
        commentId: "22222222-2222-4222-8222-222222222222",
        nextValue: true,
      }),
    })
    const response = await toggleSolution(request)
    expect(response.status).toBe(403)
  })
})
