type CommentsRouteName =
  | "thread_read"
  | "comment_create"
  | "comment_reply"
  | "comment_vote"
  | "comment_solution"

type RecordCommentsMetricInput = {
  route: CommentsRouteName
  statusCode: number
  latencyMs: number
  propositionId?: string | null
  retries?: number
  timedOut?: boolean
}

type RouteMetricsStore = {
  total: number
  success: number
  errors: number
  timeouts: number
  retries: number
  latencies: number[]
}

type RouteMetricsSnapshot = {
  route: CommentsRouteName
  total: number
  success: number
  errors: number
  timeouts: number
  retries: number
  successRate: number
  timeoutRate: number
  retryRate: number
  p95LatencyMs: number
}

const MAX_SAMPLES_PER_ROUTE = 500

const routes: CommentsRouteName[] = [
  "thread_read",
  "comment_create",
  "comment_reply",
  "comment_vote",
  "comment_solution",
]

const newStore = (): RouteMetricsStore => ({
  total: 0,
  success: 0,
  errors: 0,
  timeouts: 0,
  retries: 0,
  latencies: [],
})

const routeStores: Record<CommentsRouteName, RouteMetricsStore> = {
  thread_read: newStore(),
  comment_create: newStore(),
  comment_reply: newStore(),
  comment_vote: newStore(),
  comment_solution: newStore(),
}

const sanitizeLatency = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.round(value)
}

const percentage = (value: number, total: number): number => {
  if (total <= 0) return 0
  return Number(((value / total) * 100).toFixed(2))
}

const computeP95 = (latencies: number[]): number => {
  if (latencies.length === 0) return 0
  const sorted = [...latencies].sort((a, b) => a - b)
  const rank = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
  )
  return sorted[rank] ?? 0
}

const logMetric = (input: RecordCommentsMetricInput) => {
  const payload = {
    event: "comments.metric",
    route: input.route,
    statusCode: input.statusCode,
    latencyMs: sanitizeLatency(input.latencyMs),
    retries: Math.max(0, input.retries ?? 0),
    timedOut: Boolean(input.timedOut),
    propositionId: input.propositionId ?? null,
    recordedAt: new Date().toISOString(),
  }
  console.info(JSON.stringify(payload))
}

export function recordCommentsMetric(input: RecordCommentsMetricInput): void {
  const store = routeStores[input.route]
  const retries = Math.max(0, Math.round(input.retries ?? 0))
  const timedOut = Boolean(input.timedOut)
  const latency = sanitizeLatency(input.latencyMs)

  store.total += 1
  if (input.statusCode >= 200 && input.statusCode < 400) {
    store.success += 1
  } else {
    store.errors += 1
  }
  if (timedOut) {
    store.timeouts += 1
  }
  store.retries += retries
  store.latencies.push(latency)
  if (store.latencies.length > MAX_SAMPLES_PER_ROUTE) {
    store.latencies.splice(0, store.latencies.length - MAX_SAMPLES_PER_ROUTE)
  }

  logMetric(input)
}

export function getCommentsMetricsSnapshot(): RouteMetricsSnapshot[] {
  return routes.map((route) => {
    const store = routeStores[route]
    return {
      route,
      total: store.total,
      success: store.success,
      errors: store.errors,
      timeouts: store.timeouts,
      retries: store.retries,
      successRate: percentage(store.success, store.total),
      timeoutRate: percentage(store.timeouts, store.total),
      retryRate: percentage(store.retries, store.total),
      p95LatencyMs: computeP95(store.latencies),
    }
  })
}

export function resetCommentsMetricsForTests(): void {
  for (const route of routes) {
    routeStores[route] = newStore()
  }
}

export function createCommentsRequestTracker(route: CommentsRouteName): {
  markRetry: () => void
  markTimeout: () => void
  complete: (args: {
    statusCode: number
    propositionId?: string | null
    retries?: number
    timedOut?: boolean
  }) => void
} {
  const startedAt = Date.now()
  let retries = 0
  let timedOut = false
  let completed = false

  return {
    markRetry: () => {
      retries += 1
    },
    markTimeout: () => {
      timedOut = true
    },
    complete: ({ statusCode, propositionId, retries: retriesOverride, timedOut: timedOutOverride }) => {
      if (completed) return
      completed = true
      recordCommentsMetric({
        route,
        statusCode,
        latencyMs: Date.now() - startedAt,
        propositionId: propositionId ?? null,
        retries: typeof retriesOverride === "number" ? retriesOverride : retries,
        timedOut: typeof timedOutOverride === "boolean" ? timedOutOverride : timedOut,
      })
    },
  }
}
