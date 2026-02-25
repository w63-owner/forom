import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "@/app/api/auth/metrics/route"
import {
  recordAuthSessionMetric,
  resetAuthSessionMetricsForTests,
} from "@/lib/observability/auth-session-metrics"
import {
  createInternalRequestSignature,
  INTERNAL_SIGNATURE_HEADER,
  INTERNAL_TIMESTAMP_HEADER,
} from "@/lib/security/internal-signature"

describe("auth metrics route", () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalSigningSecret = process.env.INTERNAL_API_SIGNING_SECRET

  beforeEach(() => {
    resetAuthSessionMetricsForTests()
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    process.env.NODE_ENV = originalNodeEnv
    process.env.INTERNAL_API_SIGNING_SECRET = originalSigningSecret
  })

  it("returns auth metrics snapshot in non-production mode", async () => {
    recordAuthSessionMetric({
      route: "middleware_refresh",
      outcome: "success",
      statusCode: 200,
      latencyMs: 9,
      reason: "refresh_ok",
      path: "/fr/explore",
    })

    const request = new Request("http://localhost:3000/api/auth/metrics", {
      method: "GET",
    })
    const response = await GET(request)
    expect(response.status).toBe(200)

    const payload = (await response.json()) as {
      ok: boolean
      metrics: Array<{ route: string; total: number }>
      alerts: {
        redirectSpike: boolean
        refreshFailureSpike: boolean
        highMiddlewareLatency: boolean
      }
    }
    expect(payload.ok).toBe(true)
    const middleware = payload.metrics.find(
      (entry) => entry.route === "middleware_refresh"
    )
    expect(middleware?.total).toBe(1)
    expect(payload.alerts.redirectSpike).toBe(false)
  })

  it("rejects unsigned requests in production when secret is configured", async () => {
    process.env.NODE_ENV = "production"
    process.env.INTERNAL_API_SIGNING_SECRET = "test-secret"
    const request = new Request("http://localhost:3000/api/auth/metrics", {
      method: "GET",
    })
    const response = await GET(request)
    expect(response.status).toBe(403)
  })

  it("accepts signed requests in production when signature is valid", async () => {
    process.env.NODE_ENV = "production"
    process.env.INTERNAL_API_SIGNING_SECRET = "test-secret"
    const timestamp = Date.now().toString()
    const signature = createInternalRequestSignature({
      payload: "",
      timestamp,
      secret: "test-secret",
    })
    const request = new Request("http://localhost:3000/api/auth/metrics", {
      method: "GET",
      headers: {
        [INTERNAL_SIGNATURE_HEADER]: signature,
        [INTERNAL_TIMESTAMP_HEADER]: timestamp,
      },
    })
    const response = await GET(request)
    expect(response.status).toBe(200)
    const payload = (await response.json()) as { ok: boolean }
    expect(payload.ok).toBe(true)
  })
})
