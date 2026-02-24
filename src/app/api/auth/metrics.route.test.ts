import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "@/app/api/auth/metrics/route"
import {
  recordAuthSessionMetric,
  resetAuthSessionMetricsForTests,
} from "@/lib/observability/auth-session-metrics"

describe("auth metrics route", () => {
  beforeEach(() => {
    resetAuthSessionMetricsForTests()
    vi.spyOn(console, "info").mockImplementation(() => undefined)
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
    }
    expect(payload.ok).toBe(true)
    const middleware = payload.metrics.find(
      (entry) => entry.route === "middleware_refresh"
    )
    expect(middleware?.total).toBe(1)
  })
})
