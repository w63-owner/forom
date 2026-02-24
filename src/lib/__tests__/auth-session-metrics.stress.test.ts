import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createAuthSessionTracker,
  getAuthSessionMetricsSnapshot,
  recordAuthSessionMetric,
  resetAuthSessionMetricsForTests,
} from "@/lib/observability/auth-session-metrics"

describe("auth-session-metrics - stress", () => {
  beforeEach(() => {
    resetAuthSessionMetricsForTests()
    vi.spyOn(console, "info").mockImplementation(() => undefined)
  })

  it("handles high-volume middleware refresh metric writes", () => {
    for (let i = 0; i < 1000; i += 1) {
      recordAuthSessionMetric({
        route: "middleware_refresh",
        outcome: i % 8 === 0 ? "error" : i % 5 === 0 ? "no_session" : "success",
        statusCode: i % 8 === 0 ? 500 : 200,
        latencyMs: 3 + (i % 40),
        reason: i % 8 === 0 ? "refresh_failed:timeout" : null,
        path: "/fr/explore",
      })
    }

    const snapshot = getAuthSessionMetricsSnapshot()
    const refresh = snapshot.find((entry) => entry.route === "middleware_refresh")
    expect(refresh).toBeDefined()
    expect(refresh?.total).toBe(1000)
    expect(refresh?.success).toBe(700)
    expect((refresh?.errors ?? 0) > 100).toBe(true)
    expect((refresh?.refreshFailures ?? 0) > 100).toBe(true)
  })

  it("tracker is idempotent on complete", () => {
    const tracker = createAuthSessionTracker("auth_signout", {
      path: "/api/auth/signout",
    })
    tracker.complete({ statusCode: 200, outcome: "success" })
    tracker.complete({ statusCode: 500, outcome: "error" })

    const snapshot = getAuthSessionMetricsSnapshot()
    const signout = snapshot.find((entry) => entry.route === "auth_signout")
    expect(signout?.total).toBe(1)
    expect(signout?.success).toBe(1)
    expect(signout?.errors).toBe(0)
  })
})
