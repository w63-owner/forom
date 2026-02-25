import { describe, expect, it } from "vitest"
import { validateNotificationAuthorization } from "@/app/api/notifications/route"

function createQueryBuilder(resolveData: unknown = null) {
  const builder: Record<string, unknown> = {}
  const self = () => builder
  builder.select = self
  builder.eq = self
  builder.in = self
  builder.order = self
  builder.limit = self
  builder.maybeSingle = () => Promise.resolve({ data: resolveData, error: null })
  builder.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: resolveData, error: null }).then(resolve)
  return builder
}

const mockSupabase = (tableResolvers: Record<string, unknown> = {}) => {
  return {
    from: (table: string) => {
      if (table in tableResolvers) {
        return createQueryBuilder(tableResolvers[table])
      }
      return createQueryBuilder(null)
    },
  } as never
}

describe("validateNotificationAuthorization - all types", () => {
  it("rejects actor spoofing for any type", async () => {
    const result = await validateNotificationAuthorization({
      supabase: mockSupabase(),
      payload: {
        type: "comment_created",
        propositionId: "p1",
        commentId: "c1",
        actorUserId: "attacker",
      },
      authenticatedUserId: "real-user",
      proposition: { id: "p1", author_id: "author1", page_id: null },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("Forbidden actorUserId")
  })

  describe("comment_created", () => {
    it("rejects when commentId is missing", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase(),
        payload: { type: "comment_created", propositionId: "p1" },
        authenticatedUserId: "user1",
        proposition: { id: "p1", author_id: "user1", page_id: null },
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain("Missing comment")
    })

    it("rejects when comment not found (null data)", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase({ comments: null }),
        payload: {
          type: "comment_created",
          propositionId: "p1",
          commentId: "c1",
        },
        authenticatedUserId: "user1",
        proposition: { id: "p1", author_id: "author1", page_id: null },
      })
      expect(result.ok).toBe(false)
    })

    it("rejects when comment proposition_id does not match", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase({
          comments: { id: "c1", proposition_id: "other-prop", user_id: "user1" },
        }),
        payload: {
          type: "comment_created",
          propositionId: "p1",
          commentId: "c1",
        },
        authenticatedUserId: "user1",
        proposition: { id: "p1", author_id: "author1", page_id: null },
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain("Comment/proposition mismatch")
    })

    it("rejects when comment user does not match actor", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase({
          comments: { id: "c1", proposition_id: "p1", user_id: "other-user" },
        }),
        payload: {
          type: "comment_created",
          propositionId: "p1",
          commentId: "c1",
        },
        authenticatedUserId: "user1",
        proposition: { id: "p1", author_id: "author1", page_id: null },
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain("Forbidden comment actor")
    })

    it("accepts valid comment author", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase({
          comments: { id: "c1", proposition_id: "p1", user_id: "user1" },
        }),
        payload: {
          type: "comment_created",
          propositionId: "p1",
          commentId: "c1",
        },
        authenticatedUserId: "user1",
        proposition: { id: "p1", author_id: "author1", page_id: null },
      })
      expect(result.ok).toBe(true)
    })
  })

  describe("volunteer_created", () => {
    it("rejects when propositionId is missing", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase(),
        payload: { type: "volunteer_created" },
        authenticatedUserId: "user1",
        proposition: null,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain("Missing propositionId")
    })

    it("rejects when volunteer row not found for actor", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase({ volunteers: null }),
        payload: { type: "volunteer_created", propositionId: "p1" },
        authenticatedUserId: "user1",
        proposition: { id: "p1", author_id: "author1", page_id: null },
      })
      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.error).toContain("Forbidden volunteer actor")
    })

    it("accepts valid volunteer actor", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase({
          volunteers: { user_id: "user1" },
        }),
        payload: { type: "volunteer_created", propositionId: "p1" },
        authenticatedUserId: "user1",
        proposition: { id: "p1", author_id: "author1", page_id: null },
      })
      expect(result.ok).toBe(true)
    })
  })

  describe("solution_marked / solution_unmarked", () => {
    it("rejects when commentId is missing", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase(),
        payload: { type: "solution_marked", propositionId: "p1" },
        authenticatedUserId: "user1",
        proposition: { id: "p1", author_id: "user1", page_id: null },
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain("Missing comment")
    })

    it("rejects when comment not found for solution check", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase({ comments: null }),
        payload: {
          type: "solution_marked",
          propositionId: "p1",
          commentId: "c1",
        },
        authenticatedUserId: "user1",
        proposition: null,
      })
      expect(result.ok).toBe(false)
    })

    it("rejects when proposition is missing for solution check", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase({
          comments: { id: "c1", proposition_id: "p1", user_id: "commenter" },
        }),
        payload: {
          type: "solution_marked",
          propositionId: "p1",
          commentId: "c1",
        },
        authenticatedUserId: "user1",
        proposition: null,
      })
      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.error).toContain("Missing proposition")
    })

    it("accepts proposition author marking solution (no page)", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase({
          comments: { id: "c1", proposition_id: "p1", user_id: "commenter" },
        }),
        payload: {
          type: "solution_marked",
          propositionId: "p1",
          commentId: "c1",
        },
        authenticatedUserId: "user1",
        proposition: { id: "p1", author_id: "user1", page_id: null },
      })
      expect(result.ok).toBe(true)
    })

    it("accepts page owner marking solution", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase({
          comments: { id: "c1", proposition_id: "p1", user_id: "commenter" },
          pages: { owner_id: "user1" },
        }),
        payload: {
          type: "solution_unmarked",
          propositionId: "p1",
          commentId: "c1",
        },
        authenticatedUserId: "user1",
        proposition: { id: "p1", author_id: "other", page_id: "page1" },
      })
      expect(result.ok).toBe(true)
    })
  })

  describe("status_done / status_change", () => {
    it("rejects when proposition is missing", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase(),
        payload: { type: "status_done", propositionId: "p1" },
        authenticatedUserId: "user1",
        proposition: null,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain("Missing proposition")
    })

    it("accepts proposition author for status_done (no page)", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase(),
        payload: { type: "status_done", propositionId: "p1" },
        authenticatedUserId: "user1",
        proposition: { id: "p1", author_id: "user1", page_id: null },
      })
      expect(result.ok).toBe(true)
    })

    it("accepts page owner for status_change", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase({
          pages: { owner_id: "user1" },
        }),
        payload: {
          type: "status_change",
          propositionId: "p1",
          newStatus: "In Progress",
        },
        authenticatedUserId: "user1",
        proposition: {
          id: "p1",
          author_id: "other",
          page_id: "page1",
        },
      })
      expect(result.ok).toBe(true)
    })

    it("rejects non-owner non-author for status_change", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase({
          pages: { owner_id: "actual-owner" },
        }),
        payload: {
          type: "status_change",
          propositionId: "p1",
          newStatus: "In Progress",
        },
        authenticatedUserId: "user1",
        proposition: {
          id: "p1",
          author_id: "other",
          page_id: "page1",
        },
      })
      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.error).toContain("Forbidden status actor")
    })
  })

  describe("proposition_created_linked", () => {
    it("rejects when actor is not proposition author", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase(),
        payload: {
          type: "proposition_created_linked",
          propositionId: "p1",
        },
        authenticatedUserId: "user1",
        proposition: { id: "p1", author_id: "other", page_id: "page1" },
      })
      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.error).toContain("Forbidden proposition actor")
    })

    it("accepts proposition author", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase(),
        payload: {
          type: "proposition_created_linked",
          propositionId: "p1",
        },
        authenticatedUserId: "user1",
        proposition: { id: "p1", author_id: "user1", page_id: "page1" },
      })
      expect(result.ok).toBe(true)
    })
  })

  describe("owner_vote_threshold", () => {
    it("rejects when propositionId is missing", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase(),
        payload: { type: "owner_vote_threshold" },
        authenticatedUserId: "user1",
        proposition: null,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain("Missing propositionId")
    })

    it("rejects when vote not found for actor", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase({ votes: null }),
        payload: {
          type: "owner_vote_threshold",
          propositionId: "p1",
        },
        authenticatedUserId: "user1",
        proposition: { id: "p1", author_id: "author1", page_id: "page1" },
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain("Forbidden vote actor")
    })

    it("accepts voter with existing vote row", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase({
          votes: { user_id: "user1" },
        }),
        payload: {
          type: "owner_vote_threshold",
          propositionId: "p1",
        },
        authenticatedUserId: "user1",
        proposition: { id: "p1", author_id: "author1", page_id: "page1" },
      })
      expect(result.ok).toBe(true)
    })
  })

  describe("page_parent_request", () => {
    it("rejects when pageId or childPageId is missing", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase(),
        payload: { type: "page_parent_request", pageId: "page1" },
        authenticatedUserId: "user1",
        proposition: null,
      })
      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.error).toContain("Missing mother page payload")
    })

    it("rejects when request row not found", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase({ page_parent_requests: null }),
        payload: {
          type: "page_parent_request",
          pageId: "page1",
          childPageId: "child1",
        },
        authenticatedUserId: "user1",
        proposition: null,
      })
      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.error).toContain("Forbidden parent request actor")
    })

    it("rejects when request was made by different user", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase({
          page_parent_requests: { id: "req1", requested_by: "other-user" },
        }),
        payload: {
          type: "page_parent_request",
          pageId: "page1",
          childPageId: "child1",
        },
        authenticatedUserId: "user1",
        proposition: null,
      })
      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.error).toContain("Forbidden parent request actor")
    })

    it("accepts valid request actor", async () => {
      const result = await validateNotificationAuthorization({
        supabase: mockSupabase({
          page_parent_requests: { id: "req1", requested_by: "user1" },
        }),
        payload: {
          type: "page_parent_request",
          pageId: "page1",
          childPageId: "child1",
        },
        authenticatedUserId: "user1",
        proposition: null,
      })
      expect(result.ok).toBe(true)
    })
  })

  it("rejects unsupported notification type", async () => {
    const result = await validateNotificationAuthorization({
      supabase: mockSupabase(),
      payload: { type: "nonexistent_type" as "comment_created" },
      authenticatedUserId: "user1",
      proposition: null,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("Unsupported")
  })
})
