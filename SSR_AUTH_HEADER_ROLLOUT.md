# SSR Auth Header Rollout (Variant B)

## Purpose

Track progressive migration toward SSR-first auth header behavior:

- deterministic first paint from server session
- no text-based transient auth state in header
- client session API as resilience fallback only

## Contract

- `initialSession` (from `getServerSessionUser()`) is the source of truth for first paint.
- Client reconciliation can refine state after hydration.
- Header must not show `Chargement...` / fallback text initials while resolving.

## In Scope (implemented)

- `src/app/[locale]/page.tsx`
- `src/app/page.tsx`
- `src/app/[locale]/discover/page.tsx`
- `src/app/[locale]/discover/[universe_slug]/page.tsx`
- `src/app/[locale]/explore/page.tsx`
- `src/app/[locale]/faq/page.tsx`
- `src/app/[locale]/how-it-works/page.tsx`
- `src/app/[locale]/pages/page.tsx`
- `src/components/auth-status.tsx`
- `src/components/top-page-header.tsx`

## Next Candidate Screens (progressive migration)

Pages with page-level headers (no `AuthStatus` yet):

- `src/app/[locale]/pages/[slug]/page.tsx`

## Suggested Sequence

1. Introduce a shared SSR-compatible top header component.
2. Inject server session once per route segment where header appears.
3. Replace page-level ad-hoc headers one screen at a time.
4. Validate hard-refresh connected/non-connected before moving to next screen.

## QA Checklist

- Hard refresh (connected): immediate stable auth header.
- Hard refresh (logged out): immediate login CTA.
- Login/logout transitions: no text placeholders.
- Slow network: fallback visual stays neutral and rare.
