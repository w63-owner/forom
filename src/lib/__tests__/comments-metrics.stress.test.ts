import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createCommentsRequestTracker,
  getCommentsMetricsSnapshot,
  recordCommentsMetric,
  resetCommentsMetricsForTests,
} from "@/lib/observability/comments-metrics"

describe("comments metrics - stress", () => {
  beforeEach(() => {
    resetCommentsMetricsForTests()
    vi.spyOn(console, "info").mockImplementation(() => undefined)
  })

  it("handles 1000 thread metric writes with stable snapshot", () => {
    for (let i = 0; i < 1000; i += 1) {
      recordCommentsMetric({
        route: "thread_read",
        statusCode: i % 10 === 0 ? 500 : 200,
        latencyMs: 20 + (i % 50),
        retries: i % 3 === 0 ? 1 : 0,
        timedOut: i % 25 === 0,
        propositionId: "11111111-1111-4111-8111-111111111111",
      })
    }

    const snapshot = getCommentsMetricsSnapshot()
    const thread = snapshot.find((entry) => entry.route === "thread_read")
    expect(thread).toBeDefined()
    expect(thread?.total).toBe(1000)
    expect(thread?.errors).toBe(100)
    expect(thread?.timeouts).toBe(40)
    expect((thread?.successRate ?? 0) > 80).toBe(true)
    expect((thread?.p95LatencyMs ?? 0) >= 20).toBe(true)
  })

  it("supports concurrent tracker completion without double counting", async () => {
    const trackers = Array.from({ length: 200 }, () =>
      createCommentsRequestTracker("comment_vote")
    )

    await Promise.all(
      trackers.map(async (tracker, index) => {
        if (index % 2 === 0) tracker.markRetry()
        tracker.complete({
          statusCode: 200,
          propositionId: "11111111-1111-4111-8111-111111111111",
        })
        tracker.complete({
          statusCode: 500,
          propositionId: "11111111-1111-4111-8111-111111111111",
        })
      })
    )

    const snapshot = getCommentsMetricsSnapshot()
    const vote = snapshot.find((entry) => entry.route === "comment_vote")
    expect(vote?.total).toBe(200)
    expect(vote?.errors).toBe(0)
    expect(vote?.retries).toBe(100)
  })
})
