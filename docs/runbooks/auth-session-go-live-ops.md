# Auth Session Go-Live Ops

## Scope

This runbook consolidates the remaining auth/session go-live requirements:

- user-centric SLO definition,
- auth chaos matrix and expected behavior,
- session/cookie integrity operations,
- browser compatibility validation (Safari iOS first),
- auth incident operations (owner, rollback SLA, user messaging),
- long-run longevity test protocol.

## User-Centric SLOs (Release Gates)

Use rolling 24h windows with a 5-minute alerting granularity.

1) `unexpected_disconnect_rate`
- Definition: share of active authenticated users who transition to unauthenticated state without explicit sign-out.
- Target: <= 0.30%
- Alert: > 0.75% for 10 minutes.

2) `session_recovery_p95_seconds`
- Definition: p95 duration between first transient auth/session failure and successful user resolution.
- Target: <= 120s
- Alert: > 240s for 15 minutes.

3) `false_unauthorized_mutation_rate`
- Definition: % mutation failures classified as unauthorized while the user is confirmed valid shortly after (<= 2 minutes).
- Target: <= 0.10%
- Alert: > 0.40% for 10 minutes.

4) `middleware_refresh_error_rate`
- Source: `middleware_refresh` metrics.
- Target: <= 1.5%
- Alert: > 1.5% for 5 minutes (rollback candidate if coupled with UX impact).

5) `middleware_refresh_p95_latency_ms`
- Source: `middleware_refresh` latency.
- Target: <= 250ms
- Alert: > 400ms for 10 minutes.

## Dashboard and Alert Thresholds

Primary series:

- `auth.session.metric` by `route`, `outcome`, `reason`,
- `refreshFailures` from `/api/auth/metrics`,
- 401/403 rates for sensitive mutation APIs,
- login redirect rate for protected routes.

Minimum alerts:

- `middleware_refresh.errorRate > 1.5%` over 5m,
- `middleware_refresh.p95LatencyMs > 400` over 10m,
- sudden increase in `redirect` outcome for protected paths,
- spike in `no_session` + frontend auth warnings together.

## Auth Chaos Matrix

Execute before release and during regression windows.

1) Refresh token expires during active navigation
- Expected: no immediate logout wave; user recovers via session route/re-auth path.
- Fail criteria: repeated forced redirects while user remains valid.

2) Auth backend returns repeated 429/5xx
- Expected: bounded retries + degraded messaging; no hard logout on first failures.
- Fail criteria: logout cascade or sustained blocked mutations without recovery.

3) Offline then reconnect
- Expected: transient network degradation message; auto-recovery after reconnect.
- Fail criteria: persistent unauthorized state after connectivity restored.

4) Client clock drift
- Expected: server-side source of truth preserves authorization correctness.
- Fail criteria: false unauthorized spikes.

5) Multi-tab leader tab crash
- Expected: another tab acquires heartbeat lease and session continuity remains stable.
- Fail criteria: heartbeat stall and broad session expiration.

## Browser Compatibility Validation (Priority: Safari iOS)

Test matrix:

- Safari iOS (latest + n-1),
- Safari macOS (latest + n-1),
- Chrome stable,
- Edge stable,
- mobile WebView (if applicable).

Checklist per browser:

- login/signup/logout flow,
- protected route access with valid session,
- session continuation after 20+ minutes active usage,
- recovery after temporary offline state,
- parent-request notification actions and persisted state after reload.

Record each run with:

- browser/version/device,
- pass/fail per checklist item,
- observed regressions and logs.

## Session/Cookie Integrity Runbook

Trigger this procedure on auth inconsistency incidents.

1) Resync first
- Call `/api/auth/session` and inspect metric/log outcomes.
- Confirm whether backend still returns a valid user.

2) Targeted cookie purge
- If corruption is confirmed, purge only auth cookies for affected users/session scopes.
- Avoid global cache/cookie invalidation unless major incident is declared.

3) Correlate logs by request identifiers
- Correlate proxy (`requestId`) + auth route metrics + client auth debug logs.
- Confirm if failure source is middleware, auth backend, or client network.

4) Verify post-action
- Ensure `success` outcomes recover and unauthorized rates normalize.

## Bounded Retry / Circuit Breaker Policy

Client heartbeat behavior:

- Base heartbeat interval: 20 minutes.
- Retry windows after failures: 1m, 2m, 5m (bounded).
- Circuit breaker opens after repeated failures > retry budget.
- While open: keep user signed-in UI state when not explicitly invalidated, show degraded status.
- Recovery closes breaker only after confirmed session success.

## Explicit Sign-Out Channels

User-facing states must distinguish:

- `session_expired_confirmed`: user genuinely unauthenticated,
- `network_degraded`: temporary fetch/timeout/offline issue,
- `auth_backend_incident`: backend auth instability.

Do not treat transient transport errors as confirmed sign-out.

## Automated Longevity Test Protocol

Required automated scenario (blocking gate):

- continuous activity beyond nominal session TTL,
- temporary network failure and recovery,
- multi-tab heartbeat continuity,
- no unexpected sign-out events.

Baseline execution:

- run on each release candidate branch,
- run nightly on main,
- mark release blocked on failure.

## Incident Operations (Auth)

- Incident owner assigned before deploy window.
- Rollback decision SLA: <= 10 minutes after threshold breach.
- Pre-approved user communication templates for auth outage/degradation.
- Post-incident report within 24h: timeline, root cause, preventive actions.

Rollback triggers:

- sustained auth/session error rate > 2% with UX impact,
- strong increase in forced login redirects,
- blocking regression on parent-request notification actions,
- unresolved elevated p95 middleware latency.
