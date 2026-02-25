# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

FOROM is a collaborative feedback platform (Next.js 16 / React 19 / TypeScript / Tailwind CSS v4 / Supabase). Users submit improvement proposals for products/services, vote, comment, and propose solutions. See `README.md` for getting started basics and `.cursorrules` for architecture/security guidelines.

### Running the app

- **Dev server**: `npm run dev` (uses Turbopack, serves on `http://localhost:3000`)
- The app requires a `.env.local` with at least `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Without real Supabase credentials the UI renders but data-dependent features (auth, propositions, votes) will not work.
- Optional env vars: `SUPABASE_SERVICE_ROLE_KEY` (storage bucket auto-creation), `RESEND_API_KEY` (email notifications), `INTERNAL_API_SIGNING_SECRET`, `NEXT_PUBLIC_APP_URL`.
- The Supabase client gracefully returns `null` when credentials are missing/invalid — the app will not crash.

### Lint / Test / Build

- **Lint**: `npx eslint .` — pre-existing warnings and errors exist in the codebase (unused vars, `no-explicit-any`, React hooks deps).
- **Tests**: `npx vitest run` — 32 test files (unit, stress, chaos). 3 pre-existing failures in `auth-check.chaos.test.ts` and `auth-modal-state.test.ts`.
- **Build**: `npm run build` (requires valid Supabase credentials for server components that call Supabase at build time).

### Creating a test user

To create a pre-confirmed test user (bypassing email OTP verification), use the Supabase Admin API with the service role key:

```js
node -e "
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
sb.auth.admin.createUser({ email: 'test@example.dev', password: 'TestPass123!', email_confirm: true }).then(r => console.log(r.data?.user?.id || r.error));
"
```

Sign-up via the UI requires OTP email verification, so admin-created users are needed for automated testing.

### Key caveats

- No Docker or local Supabase setup — the project relies on a cloud-hosted Supabase instance.
- Database migrations are in `supabase/migrations/` (37 SQL files) but there is no `supabase/config.toml` for local Supabase CLI usage.
- i18n: routes are locale-prefixed (`/fr`, `/en`). The root `/` redirects to the default locale.
- No git hooks, lint-staged, or pre-commit configuration.
- `.env.local` is gitignored. On a fresh VM, recreate it from the injected environment secrets (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
