import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { resolveAuthUser, __resetAuthSnapshotForTests } from "@/utils/supabase/auth-check"

const mockUser: User = {
  id: "stress-user",
  email: "stress@example.com",
  user_metadata: null,
} as User

function createMockSupabase(delayMs = 5): SupabaseClient {
  return {
    auth: {
      getSession: () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve({ data: { session: { user: mockUser } } }),
            delayMs
          )
        }),
      getUser: () =>
        Promise.resolve({ data: { user: mockUser } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
        subscription: { unsubscribe: vi.fn() },
      }),
    },
  } as unknown as SupabaseClient
}

describe("resolveAuthUser - stress", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    __resetAuthSnapshotForTests()
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: null }), { status: 200 })
    )
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("stress: 50 concurrent resolveAuthUser calls all resolve to the same user", async () => {
    const supabase = createMockSupabase(10)
    const concurrency = 50
    const promises = Array.from({ length: concurrency }, () =>
      resolveAuthUser(supabase, { timeoutMs: 5000, includeServerFallback: false })
    )
    const results = await Promise.all(promises)
    expect(results).toHaveLength(concurrency)
    const ids = results.map((u) => u?.id).filter(Boolean)
    expect(ids).toHaveLength(concurrency)
    expect(new Set(ids).size).toBe(1)
    expect(ids[0]).toBe("stress-user")
  })

  it("stress: 100 rapid sequential resolveAuthUser calls (no race on inFlight)", async () => {
    const supabase = createMockSupabase(2)
    const results: (User | null)[] = []
    for (let i = 0; i < 100; i++) {
      __resetAuthSnapshotForTests()
      const user = await resolveAuthUser(supabase, {
        timeoutMs: 5000,
        includeServerFallback: false,
      })
      results.push(user)
    }
    expect(results.every((u) => u?.id === "stress-user")).toBe(true)
  })
})