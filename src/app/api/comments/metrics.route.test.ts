import { beforeEach, describe, expect, it } from "vitest"
import { GET } from "@/app/api/comments/metrics/route"
import {
  recordCommentsMetric,
  resetCommentsMetricsForTests,
} from "@/lib/observability/comments-metrics"

describe("comments metrics route", () => {
  beforeEach(() => {
    resetCommentsMetricsForTests()
  })

  it("returns snapshot payload in non-production mode", async () => {
    recordCommentsMetric({
      route: "thread_read",
      statusCode: 200,
      latencyMs: 42,
      retries: 1,
      timedOut: false,
      propositionId: "11111111-1111-4111-8111-111111111111",
    })

    const request = new Request("http://localhost:3000/api/comments/metrics", {
      method: "GET",
    })
    const response = await GET(request)
    expect(response.status).toBe(200)

    const payload = (await response.json()) as {
      ok: boolean
      metrics: Array<{ route: string; total: number }>
    }
    expect(payload.ok).toBe(true)
    const thread = payload.metrics.find((entry) => entry.route === "thread_read")
    expect(thread?.total).toBe(1)
  })
})
