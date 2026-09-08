<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# InstaScaler agent guide

These instructions apply to Codex, Claude Code, and every AI agent editing this repository. `CLAUDE.md` imports this file, so keep the shared rules here instead of duplicating them.

## Mission

Maintain InstaScaler as a small, self-hosted Instagram comment-to-DM system built for Cloudflare's serverless runtime. Prefer the smallest correct change. Do not add a service, dependency, abstraction, queue, database, or configuration layer unless the current architecture cannot solve the requirement.

## Read before editing

1. Read the files you will change and every direct caller.
2. For Next.js work, read the relevant current guide in `node_modules/next/dist/docs/` first. This repository uses Next.js 16 and React 19; do not rely on older conventions from memory.
3. For deployment or environment changes, read all three `wrangler.*.jsonc` files and `.env.example`.
4. For event delivery changes, trace the whole path through:
   - `workers/core/routes/webhook.ts`
   - `lib/events/journal.ts`
   - `lib/jobs/contracts.ts`
   - `workers/jobs/index.ts`
   - `lib/delivery/index.ts`
   - `lib/delivery/runtime.ts`
5. For database changes, read `prisma/schema.prisma`, the latest migration, and every query touching the affected model.
6. Treat `README.md`, `INSTRUKCJA.md`, `.env.example`, and the Wrangler configs as public contracts. Update them when behavior or setup changes.

## Runtime architecture

- `instascaler-web`: Next.js UI compiled by OpenNext. Browser-facing pages live in `app/`; reusable UI lives in `components/`.
- `instascaler-core`: Hono Worker serving `/api/*`, `/webhook`, `/r/*`, and `/health`. It owns authentication, CRUD APIs, OAuth, webhook verification, journaling, and Queue publishing.
- `instascaler-jobs`: Queue consumer and internal scheduler endpoint. It owns delivery, retries, rate limiting, and Cloudflare Workflows.
- Neon Postgres: durable application state, idempotency, logs, budgets, campaigns, accounts, and analytics.
- R2 `EVENT_JOURNAL`: full normalized webhook envelopes retained until terminal handling.
- Queue `INSTAGRAM_EVENTS`: compact jobs containing identifiers and an R2 key, never access tokens or full webhook payloads.
- Durable Objects: `LOGIN_THROTTLE`, `ACCOUNT_RATE_LIMITER`, and `WORKFLOW_SCHEDULER`.

Do not collapse these boundaries. Web must not call Meta directly. Core must not perform slow delivery side effects inside the webhook response. Queue jobs must remain compact. Jobs must not bypass the per-account rate limiter.

## Event invariants

Preserve these rules for every webhook or delivery change:

1. Verify `X-Hub-Signature-256` before parsing or trusting a Meta webhook.
2. Normalize external input at the Core boundary.
3. Give every event a stable `externalId` for idempotency.
4. Write the full normalized envelope to R2 before publishing its compact Queue job.
5. Reserve inbound and retry budgets in Neon.
6. Use `ProcessedEvent` to prevent duplicate terminal delivery.
7. Reserve `ACCOUNT_RATE_LIMITER` capacity before every Graph API send.
8. Delete the R2 object only after a sent or deliberately skipped terminal result.
9. Return retry for transient failures; record permanent failures with a safe diagnostic code.
10. Never log access tokens, secrets, authorization headers, raw passwords, or full webhook bodies.

Supported inbound kinds are `COMMENT`, `POSTBACK`, and `MESSAGE`. `FOLLOW_UP` is an internal delayed Queue job. Recovery, reconciliation, token refresh, next-Reel attachment, follower snapshots, and retention run through Cloudflare Workflows started by `WORKFLOW_SCHEDULER`.

`QUIZ_STEP` is an internal send-only job containing work/run references, never contact data or tokens. Durable `QuizWork` precedes its `quiz-steps/` R2 reference and Queue publication. Contact locks, revision checks and unique QuizEvent IDs protect transitions. A quiz has at most 10 total nodes; all local computation is bounded and uses the same engine as preview. Runs pin immutable QuizVersion graphs. Do not retry SENDING/UNKNOWN work blindly. Use verified source interaction timestamps for messaging eligibility. Deleted contact tombstones prevent old journals from restoring personal data. Contacts, answers and qualification are private and must never enter public reports.

## Implementation rules

### UI and Next.js

- Use Server Components by default; add `"use client"` only where browser state or effects are required.
- Use `next/link` for application navigation. Plain `<a>` is for external URLs or deliberate browser-level downloads.
- Keep API access behind existing clients and routes; do not expose Worker secrets to client bundles.
- Reuse existing classes and components before adding new variants.
- Preserve accessibility: semantic controls, labels, keyboard behavior, focus states, and useful error text.

### Core API

- Validate request bodies with existing Zod/service patterns.
- Require admin authentication and same-origin protection on private mutation routes.
- Keep webhook verification and normalization in the webhook boundary.
- Return stable, non-sensitive error codes. Unexpected errors receive a request ID; secrets never enter the response.

### Jobs and Meta delivery

- Put campaign matching and delivery behavior in `lib/delivery/`, not the Worker entrypoint.
- Keep the Queue consumer responsible only for parsing, loading state, invoking delivery, acknowledging, and retrying.
- Treat Meta rate limits, temporary API failures, Neon outages, and missing R2 objects explicitly.
- Keep follow-gate ordering intact: opening DM, follow check/prompt, reveal, optional delayed follow-up.
- Use official Meta APIs only. Never add scraping, stored Instagram passwords, or browser automation.

### Database

- Change `prisma/schema.prisma` and add a migration together.
- Use indexed, bounded queries for operational scans and dashboards.
- Preserve unique identifiers used for deduplication: event external IDs, delivery external IDs, link slugs, and report share slugs.
- Run `npm run db:generate` after schema changes. Do not hand-edit generated Prisma files under `app/generated/`.

### Cloudflare

- Keep binding names synchronized across `lib/cloudflare/env.ts`, Wrangler configs, and Worker code.
- A new binding requires documentation in `.env.example` or the relevant Wrangler file and deployment instructions in `INSTRUKCJA.md`.
- Do not add Hyperdrive or Redis; the current design uses the Neon serverless adapter, Queue, R2, Durable Objects, and Workflows.
- Deploy order is Jobs, Core, then Web. The web build must exist before Web deployment.

## Security

- Never commit `.env`, credentials, tokens, personal deployment domains, or generated scan reports containing secret values.
- Store production values with `wrangler secret put`; keep local values only in ignored environment files.
- Keep Meta tokens encrypted with `ENCRYPTION_KEY` at rest.
- Keep admin passwords out of storage; use the generated pepper/verifier pair.
- Before a public push, scan only the latest commit with `ggshield secret scan commit-range "HEAD^!"` and inspect the changes being published. Do not scan the full Git history unless the user explicitly requests it.
- Do not weaken signature verification, session signing, origin checks, login throttling, rate limiting, or idempotency to make a test pass.

## Tests

Tests live in `__tests__/**/*.test.ts` and use Vitest with the `@/` alias. Cloudflare runtime imports are mapped to `test-support/cloudflare-workers.ts`.

For behavior changes:

1. Add or update the smallest test that demonstrates the requirement or regression.
2. Run the focused file: `npx vitest run __tests__/NAME.test.ts`.
3. Run the required repository checks:

```bash
npm test
npm run typecheck
npm run lint
```

Also run checks matching the changed surface:

- Prisma: `npm run db:generate` and `npx prisma validate`.
- Web/Next.js: `npm run build` or `npm run cf:build:web` when Cloudflare compatibility matters.
- Core/Jobs bindings: `npx wrangler deploy --dry-run --config wrangler.core.jsonc` and/or `wrangler.jobs.jsonc`.
- E2E flows: `npm run test:e2e` only when the required `E2E_*` environment is available.
- Documentation: `git diff --check` plus a search for real domains and credentials.

Do not claim a check passed unless you ran it and saw exit code `0`. If an existing unrelated failure blocks verification, report the exact command and error.

## Change checklist

Before finishing:

- Inspect `git diff` and keep unrelated user changes untouched.
- Confirm no generated build output, logs, `.env`, `.firecrawl`, or `.open-next-stale-*` files are staged.
- Update README for user-visible behavior and `INSTRUKCJA.md` for setup/deployment changes.
- Before committing, run `ggshield secret scan pre-commit` on staged changes only (the local pre-commit hook does this). Before pushing, scan only `HEAD` as described above.
- Use a focused conventional commit message.
- Push only when the user explicitly asks.

## Useful commands

```bash
npm ci
npm run dev
npm test
npm run typecheck
npm run lint
npm run db:generate
npm run db:migrate
npm run cf:build:web
npm run cf:dev:core
npm run cf:dev:jobs
npm run cf:deploy:jobs
npm run cf:deploy:core
npm run cf:deploy:web
```
