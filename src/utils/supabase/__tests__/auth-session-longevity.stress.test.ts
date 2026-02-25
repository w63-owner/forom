import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { resolveAuthUser, __resetAuthSnapshotForTests } from "@/utils/supabase/auth-check"

const baseUser: User = {
  id: "longevity-user",
  email: "longevity@example.com",
  user_metadata: { username: "longevity" },
} as User

function createSupabaseForLongevity(sequence: Array<User | null>): SupabaseClient {
  let idx = 0
  return {
    auth: {
      getSession: () => {
        const current = sequence[Math.min(idx, sequence.length - 1)] ?? null
        idx += 1
        return Promise.resolve({
          data: { session: current ? { user: current } : null },
})
      },
      getUser: () => Promise.resolve({ data: { user: baseUser } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
        subscription: { unsubscribe: vi.fn() },
      }),
    },
  } as unknown as SupabaseClient
}

describe("resolveAuthUser - longevity", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    __resetAuthSnapshotForTests()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("keeps user resolved through intermittent null sessions", async () => {
    const supabase = createSupabaseForLongevity([
      baseUser,
      baseUser,
      null,
      baseUser,
      null,
      baseUser,
      baseUser,
    ])
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            user: {
              id: baseUser.id,
              email: baseUser.email,
              user_metadata: baseUser.user_metadata,
            },
          }),
          { status: 200 }
        )
      )

    const results: Array<string | null | undefined> = []
    for (let i = 0; i < 60; i += 1) {
      const user = await resolveAuthUser(supabase, {
        timeoutMs: 6000,
        includeServerFallback: true,
      })
      results.push(user?.id)
      __resetAuthSnapshotForTests()
    }

    const successCount = results.filter((id) => id === baseUser.id).length
    expect(successCount).toBeGreaterThan(45)
  })

  it("does not throw under repeated transient network failures", async () => {
    const supabase = {
      auth: {
        getSession: () => Promise.reject(new Error("Network request failed")),
        getUser: () => Promise.resolve({ data: { user: baseUser } }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: vi.fn() } },
          subscription: { unsubscribe: vi.fn() },
        }),
      },
    } as unknown as SupabaseClient

    let call = 0
    globalThis.fetch = vi.fn().mockImplementation(() => {
      call += 1
      if (call % 3 === 0) {
        return Promise.resolve(
          new Response(JSON.stringify({ user: null }), { status: 200 })
        )
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            user: {
              id: baseUser.id,
              email: baseUser.email,
              user_metadata: baseUser.user_metadata,
            },
          }),
          { status: 200 }
        )
      )
    })

    for (let i = 0; i < 30; i += 1) {
      await expect(
        resolveAuthUser(supabase, {
          timeoutMs: 6000,
          includeServerFallback: true,
        })
      ).resolves.not.toThrow()
      __resetAuthSnapshotForTests()
    }
  })
})
