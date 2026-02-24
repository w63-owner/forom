import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  mockGetSupabaseServerClient,
  mockLoadEnrichedCommentsFlat,
  mockComplete,
} = vi.hoisted(() => ({
  mockGetSupabaseServerClient: vi.fn(),
  mockLoadEnrichedCommentsFlat: vi.fn(),
  mockComplete: vi.fn(),
}))

vi.mock("@/utils/supabase/server", () => ({
  getSupabaseServerClient: mockGetSupabaseServerClient,
}))

vi.mock("@/lib/comments/thread-loader", () => ({
  loadEnrichedCommentsFlat: mockLoadEnrichedCommentsFlat,
}))

vi.mock("@/lib/observability/comments-metrics", () => ({
  createCommentsRequestTracker: () => ({
    complete: mockComplete,
  }),
}))

import { GET } from "@/app/api/comments/thread/route"

describe("comments thread route", () => {
  beforeEach(() => {
    mockGetSupabaseServerClient.mockReset()
    mockLoadEnrichedCommentsFlat.mockReset()
    mockComplete.mockReset()
  })

  it("returns comments from shared loader", async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "viewer-1" } } }),
      },
    }
    mockGetSupabaseServerClient.mockResolvedValue(supabase)
    mockLoadEnrichedCommentsFlat.mockResolvedValue({
      propositionAuthorId: "author-1",
      comments: [{ id: "c1", content: "hello" }],
    })

    const response = await GET(
      new Request(
        "http://localhost:3000/api/comments/thread?propositionId=11111111-1111-4111-8111-111111111111"
      )
    )
    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      ok: boolean
      comments: Array<{ id: string; content: string }>
    }
    expect(payload.ok).toBe(true)
    expect(payload.comments).toEqual([{ id: "c1", content: "hello" }])
    expect(mockLoadEnrichedCommentsFlat).toHaveBeenCalledTimes(1)
  })
})
