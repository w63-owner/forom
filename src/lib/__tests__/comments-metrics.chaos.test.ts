import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createCommentsRequestTracker,
  getCommentsMetricsSnapshot,
  recordCommentsMetric,
  resetCommentsMetricsForTests,
} from "@/lib/observability/comments-metrics"

describe("comments metrics - chaos", () => {
  beforeEach(() => {
    resetCommentsMetricsForTests()
    vi.spyOn(console, "info").mockImplementation(() => undefined)
  })

  it("sanitizes negative/invalid latencies and retries", () => {
    recordCommentsMetric({
      route: "comment_create",
      statusCode: 200,
      latencyMs: -25,
      retries: -2,
      timedOut: false,
      propositionId: null,
    })
    recordCommentsMetric({
      route: "comment_create",
      statusCode: 500,
      latencyMs: Number.NaN,
      retries: 3.8,
      timedOut: true,
      propositionId: null,
    })

    const snapshot = getCommentsMetricsSnapshot()
    const createRoute = snapshot.find((entry) => entry.route === "comment_create")
    expect(createRoute?.total).toBe(2)
    expect(createRoute?.errors).toBe(1)
    expect(createRoute?.timeouts).toBe(1)
    expect(createRoute?.retries).toBe(4)
    expect(createRoute?.p95LatencyMs).toBe(0)
  })

  it("tracks retries and timeout flags from request tracker", () => {
    const tracker = createCommentsRequestTracker("thread_read")
    tracker.markRetry()
    tracker.markRetry()
    tracker.markTimeout()
    tracker.complete({
      statusCode: 200,
      propositionId: "11111111-1111-4111-8111-111111111111",
    })

    const snapshot = getCommentsMetricsSnapshot()
    const thread = snapshot.find((entry) => entry.route === "thread_read")
    expect(thread?.total).toBe(1)
    expect(thread?.retries).toBe(2)
    expect(thread?.timeouts).toBe(1)
    expect(thread?.success).toBe(1)
  })
})
