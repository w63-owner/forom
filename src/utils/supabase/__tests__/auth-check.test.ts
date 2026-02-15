import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { resolveAuthUser, __resetAuthSnapshotForTests, getAuthSnapshotUser } from "@/utils/supabase/auth-check"

const mockUser: User = {
  id: "user-1",
  email: "test@example.com",
  user_metadata: { username: "testuser" },
} as User

function createMockSupabase(overrides: {
  getSession?: () => Promise<{ data: { session: { user: User } | null } }>
  getUser?: () => Promise<{ data: { user: User | null } }>
}): SupabaseClient {
  return {
    auth: {
      getSession:
        overrides.getSession ??
        (() => Promise.resolve({ data: { session: null } })),
      getUser:
        overrides.getUser ??
        (() => Promise.resolve({ data: { user: null } })),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => ({
        data: { subscription: { unsubscribe: vi.fn() } },
        subscription: { unsubscribe: vi.fn() },
      }),
    },
  } as unknown as SupabaseClient
}

describe("resolveAuthUser - QA", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    __resetAuthSnapshotForTests()
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("returns client user when getSession resolves with user (client wins)", async () => {
    const supabase = createMockSupabase({
      getSession: () =>
        Promise.resolve({ data: { session: { user: mockUser } } }),
    })
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 5000,
      includeServerFallback: true,
    })
    expect(user?.id).toBe("user-1")
    expect(user?.email).toBe("test@example.com")
  })

  it("returns server user when client is null and server returns 200 with user (parallel fallback)", async () => {
    const supabase = createMockSupabase({
      getSession: () => Promise.resolve({ data: { session: null } }),
    })
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: "server-user",
            email: "server@example.com",
            user_metadata: null,
          },
        }),
        { status: 200 }
      )
    )
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 5000,
      includeServerFallback: true,
    })
    expect(user?.id).toBe("server-user")
    expect(user?.email).toBe("server@example.com")
  })

  it("returns null when both client and server have no session", async () => {
    const supabase = createMockSupabase({
      getSession: () => Promise.resolve({ data: { session: null } }),
    })
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ user: null }), { status: 200 })
    )
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 5000,
      includeServerFallback: true,
    })
    expect(user).toBeNull()
  })

  it("prefers client user over server when both resolve (client first)", async () => {
    const supabase = createMockSupabase({
      getSession: () =>
        Promise.resolve({ data: { session: { user: mockUser } } }),
    })
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          user: { id: "server-only", email: "server@example.com", user_metadata: null },
        }),
        { status: 200 }
      )
    )
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 5000,
      includeServerFallback: true,
    })
    expect(user?.id).toBe("user-1")
  })

  it("does not call server when includeServerFallback is false", async () => {
    const supabase = createMockSupabase({
      getSession: () => Promise.resolve({ data: { session: null } }),
    })
    await resolveAuthUser(supabase, {
      timeoutMs: 5000,
      includeServerFallback: false,
    })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it("returns null from server when response is not ok (e.g. 500) and client is null", async () => {
    const supabase = createMockSupabase({
      getSession: () => Promise.resolve({ data: { session: null } }),
    })
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("Server Error", { status: 500 })
    )
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 5000,
      includeServerFallback: true,
    })
    expect(user).toBeNull()
  })

  it("updates getAuthSnapshotUser after resolution", async () => {
    const supabase = createMockSupabase({
      getSession: () =>
        Promise.resolve({ data: { session: { user: mockUser } } }),
    })
    expect(getAuthSnapshotUser()).toBeNull()
    const user = await resolveAuthUser(supabase, { includeServerFallback: false })
    expect(user?.id).toBe("user-1")
    expect(getAuthSnapshotUser()?.id).toBe("user-1")
  })
})