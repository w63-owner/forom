type AuthMetricsRoute =
  | "middleware_refresh"
  | "auth_session_route"
  | "auth_callback"
  | "auth_signout"

type AuthMetricsOutcome =
  | "success"
  | "no_session"
  | "unauthorized"
  | "redirect"
  | "error"
  | "skipped"

type RecordAuthMetricInput = {
  route: AuthMetricsRoute
  outcome: AuthMetricsOutcome
  statusCode: number
  latencyMs: number
  reason?: string | null
  path?: string | null
}

type AuthRouteMetricsStore = {
  total: number
  success: number
  noSession: number
  unauthorized: number
  redirects: number
  errors: number
  skipped: number
  refreshFailures: number
  latencies: number[]
}

type AuthRouteMetricsSnapshot = {
  route: AuthMetricsRoute
  total: number
  success: number
  noSession: number
  unauthorized: number
  redirects: number
  errors: number
  skipped: number
  refreshFailures: number
  successRate: number
  noSessionRate: number
  errorRate: number
  p95LatencyMs: number
}

const MAX_SAMPLES_PER_ROUTE = 500
const ROUTES: AuthMetricsRoute[] = [
  "middleware_refresh",
  "auth_session_route",
  "auth_callback",
  "auth_signout",
]

const newStore = (): AuthRouteMetricsStore => ({
  total: 0,
  success: 0,
  noSession: 0,
  unauthorized: 0,
  redirects: 0,
  errors: 0,
  skipped: 0,
  refreshFailures: 0,
  latencies: [],
})

const routeStores: Record<AuthMetricsRoute, AuthRouteMetricsStore> = {
  middleware_refresh: newStore(),
  auth_session_route: newStore(),
  auth_callback: newStore(),
  auth_signout: newStore(),
}

const sanitizeLatency = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.round(value)
}

const percentage = (value: number, total: number): number => {
  if (total <= 0) return 0
  return Number(((value / total) * 100).toFixed(2))
}

const p95 = (samples: number[]): number => {
  if (samples.length === 0) return 0
  const sorted = [...samples].sort((a, b) => a - b)
  const rank = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
  )
  return sorted[rank] ?? 0
}

export function recordAuthSessionMetric(input: RecordAuthMetricInput): void {
  const store = routeStores[input.route]
  const latencyMs = sanitizeLatency(input.latencyMs)

  store.total += 1
  if (input.outcome === "success") store.success += 1
  if (input.outcome === "no_session") store.noSession += 1
  if (input.outcome === "unauthorized") store.unauthorized += 1
  if (input.outcome === "redirect") store.redirects += 1
  if (input.outcome === "error") store.errors += 1
  if (input.outcome === "skipped") store.skipped += 1
  if (input.reason?.includes("refresh_failed")) store.refreshFailures += 1

  store.latencies.push(latencyMs)
  if (store.latencies.length > MAX_SAMPLES_PER_ROUTE) {
    store.latencies.splice(0, store.latencies.length - MAX_SAMPLES_PER_ROUTE)
  }

  console.info(
    JSON.stringify({
      event: "auth.session.metric",
      route: input.route,
      outcome: input.outcome,
      statusCode: input.statusCode,
      latencyMs,
      reason: input.reason ?? null,
      path: input.path ?? null,
      recordedAt: new Date().toISOString(),
    })
  )
}

export function getAuthSessionMetricsSnapshot(): AuthRouteMetricsSnapshot[] {
  return ROUTES.map((route) => {
    const store = routeStores[route]
    return {
      route,
      total: store.total,
      success: store.success,
      noSession: store.noSession,
      unauthorized: store.unauthorized,
      redirects: store.redirects,
      errors: store.errors,
      skipped: store.skipped,
      refreshFailures: store.refreshFailures,
      successRate: percentage(store.success, store.total),
      noSessionRate: percentage(store.noSession, store.total),
      errorRate: percentage(store.errors, store.total),
      p95LatencyMs: p95(store.latencies),
    }
  })
}

export function resetAuthSessionMetricsForTests(): void {
  for (const route of ROUTES) {
    routeStores[route] = newStore()
  }
}

export function createAuthSessionTracker(
  route: AuthMetricsRoute,
  base?: { path?: string | null }
): {
  complete: (args: {
    statusCode: number
    outcome: AuthMetricsOutcome
    reason?: string | null
    path?: string | null
  }) => void
} {
  const startedAt = Date.now()
  let completed = false
  return {
    complete: ({ statusCode, outcome, reason, path }) => {
      if (completed) return
      completed = true
      recordAuthSessionMetric({
        route,
        outcome,
        statusCode,
        latencyMs: Date.now() - startedAt,
        reason,
        path: path ?? base?.path ?? null,
      })
    },
  }
}
