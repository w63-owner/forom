import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { resolveAuthUser, __resetAuthSnapshotForTests } from "@/utils/supabase/auth-check"
const mockUser: User = {
  id: "chaos-user",
  email: "chaos@example.com",
  user_metadata: null,
} as User

describe("resolveAuthUser - chaos", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    __resetAuthSnapshotForTests()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("chaos: when client getSession throws (non-timeout), Promise.all rejects; server is not used because client and server run in parallel and one rejection fails the race", async () => {
    const supabase = {
      auth: {
        getSession: () => Promise.reject(new Error("network error")),
        getUser: () => Promise.resolve({ data: { user: mockUser } }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: vi.fn() } },
          subscription: { unsubscribe: vi.fn() },
        }),
      },
    } as unknown as SupabaseClient
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: { id: mockUser.id, email: mockUser.email, user_metadata: null },
        }),
        { status: 200 }
      )
    )
    await expect(
      resolveAuthUser(supabase, { timeoutMs: 5000, includeServerFallback: true })
    ).rejects.toThrow("network error")
  })

  it("chaos: when fetch fails (network error), client user is still returned", async () => {
    const supabase = {
      auth: {
        getSession: () =>
          Promise.resolve({ data: { session: { user: mockUser } } }),
        getUser: () => Promise.resolve({ data: { user: mockUser } }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: vi.fn() } },
          subscription: { unsubscribe: vi.fn() },
        }),
      },
    } as unknown as SupabaseClient
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network request failed"))
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 5000,
      includeServerFallback: true,
    })
    expect(user?.id).toBe("chaos-user")
  })

  it("chaos: when both client and server fail, promise rejects (no unhandled rejection)", async () => {
    const supabase = {
      auth: {
        getSession: () => Promise.reject(new Error("client fail")),
        getUser: () => Promise.reject(new Error("getUser fail")),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: vi.fn() } },
          subscription: { unsubscribe: vi.fn() },
        }),
      },
    } as unknown as SupabaseClient
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("fetch fail"))
    await expect(
      resolveAuthUser(supabase, { timeoutMs: 5000, includeServerFallback: true })
    ).rejects.toThrow("client fail")
  })

  it("chaos: server returns 500, client null → result is null (server error not treated as logout)", async () => {
    const supabase = {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } }),
        getUser: () => Promise.resolve({ data: { user: null } }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: vi.fn() } },
          subscription: { unsubscribe: vi.fn() },
        }),
      },
    } as unknown as SupabaseClient
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("Internal Server Error", { status: 500 })
    )
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 5000,
      includeServerFallback: true,
    })
    expect(user).toBeNull()
  })

  it("chaos: client getSession returns null, server returns user → user from server", async () => {
    const supabase = {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } }),
        getUser: () => Promise.resolve({ data: { user: mockUser } }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: vi.fn() } },
          subscription: { unsubscribe: vi.fn() },
        }),
      },
    } as unknown as SupabaseClient
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: { id: mockUser.id, email: mockUser.email, user_metadata: null },
        }),
        { status: 200 }
      )
    )
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 5000,
      includeServerFallback: true,
    })
    expect(user?.id).toBe("chaos-user")
  })
})