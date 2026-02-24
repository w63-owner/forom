import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  getAuthSessionMetricsSnapshot,
  recordAuthSessionMetric,
  resetAuthSessionMetricsForTests,
} from "@/lib/observability/auth-session-metrics"

describe("auth-session-metrics - chaos", () => {
  beforeEach(() => {
    resetAuthSessionMetricsForTests()
    vi.spyOn(console, "info").mockImplementation(() => undefined)
  })

  it("sanitizes invalid latency values", () => {
    recordAuthSessionMetric({
      route: "auth_session_route",
      outcome: "no_session",
      statusCode: 200,
      latencyMs: -120,
      reason: "no_active_session",
      path: "/api/auth/session",
    })
    recordAuthSessionMetric({
      route: "auth_session_route",
      outcome: "error",
      statusCode: 500,
      latencyMs: Number.NaN,
      reason: "refresh_failed:timeout",
      path: "/api/auth/session",
    })

    const snapshot = getAuthSessionMetricsSnapshot()
    const session = snapshot.find((entry) => entry.route === "auth_session_route")
    expect(session?.total).toBe(2)
    expect(session?.noSession).toBe(1)
    expect(session?.errors).toBe(1)
    expect(session?.refreshFailures).toBe(1)
    expect(session?.p95LatencyMs).toBe(0)
  })

  it("tracks redirect and unauthorized outcomes independently", () => {
    recordAuthSessionMetric({
      route: "auth_callback",
      outcome: "redirect",
      statusCode: 307,
      latencyMs: 21,
      reason: "onboarding_required",
      path: "/auth/callback",
    })
    recordAuthSessionMetric({
      route: "auth_signout",
      outcome: "unauthorized",
      statusCode: 403,
      latencyMs: 4,
      reason: "origin_validation_failed",
      path: "/api/auth/signout",
    })

    const snapshot = getAuthSessionMetricsSnapshot()
    const callback = snapshot.find((entry) => entry.route === "auth_callback")
    const signout = snapshot.find((entry) => entry.route === "auth_signout")
    expect(callback?.redirects).toBe(1)
    expect(signout?.unauthorized).toBe(1)
  })
})
