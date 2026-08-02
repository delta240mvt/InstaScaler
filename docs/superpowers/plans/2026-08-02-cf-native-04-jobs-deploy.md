# Cloudflare Jobs and Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute inline; do not use subagent-driven development.

**Goal:** Replace BullMQ, Redis, the persistent worker, and Vercel cron with R2-journaled Cloudflare Queues, a Jobs Worker, Durable Objects, Workflows, Cron Triggers, and a verified free-tier deployment.

**Architecture:** Core journals verified Meta events in R2 and publishes compact queue messages. Jobs consumes idempotently against Neon, uses a Durable Object for per-account capacity, delays follow-ups in Queue, and runs only low-volume recovery/maintenance in Workflows.

**Tech Stack:** Cloudflare Queues, R2, Workflows, Durable Objects SQLite, Cron Triggers, Neon Serverless, Prisma, Vitest, Wrangler.

## Global Constraints

- Queue payloads remain below 64 KB and accepted webhook envelopes remain in R2 until Neon records a terminal result.
- At most five Instagram accounts and 1,000 incoming comment/DM events per UTC day.
- Polling reconciliation runs hourly.
- Follow-up delay is 0 through 24 hours.
- Detailed records expire after 90 days; daily aggregates remain.
- No Redis, BullMQ, always-on process, Vercel cron, Hyperdrive, or paid overflow.
- Use TDD and commit each task.

---

### Task 1: R2 webhook ingress journal

**Files:**
- Create: `lib/events/journal.ts`
- Create: `workers/core/routes/webhook.ts`
- Modify: `workers/core/index.ts`
- Modify: `wrangler.core.jsonc`
- Modify: `wrangler.jobs.jsonc`
- Delete: `app/api/webhook/route.ts`
- Create: `__tests__/webhook-journal.test.ts`

**Interfaces:**
- `journalEvent(bucket, envelope): Promise<{ key: string; externalId: string }>`
- `loadJournalEvent(bucket, key): Promise<EventEnvelope>`
- `deleteJournalEvent(bucket, key): Promise<void>`
- R2 binding name: `EVENT_JOURNAL`.
- Queue binding name: `INSTAGRAM_EVENTS`.

- [ ] **Step 1: Write failing journal tests**

Test valid Meta signature, invalid signature `401`, deterministic R2 key, payload below 64 KB, R2 write before Queue send, no `200` when either persistence operation fails, and retained R2 object when Queue send fails.

- [ ] **Step 2: Implement normalized envelopes**

Store only fields needed to process comments, postbacks, and inbound messages plus `receivedAt`, `externalId`, `kind`, and schema `version: 1`. Use keys `events/YYYY-MM-DD/<sha256-external-id>.json`. Never store request headers, access tokens, cookies, or unrelated Meta payload fields.

- [ ] **Step 3: Bind R2 and Queue**

Declare the same R2 bucket in Core and Jobs configs; Core is producer and Jobs is consumer. Queue retention remains Free default 24 hours; R2 lifecycle is controlled by successful processing and recovery.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run __tests__/webhook-journal.test.ts`

```powershell
git add lib/events workers/core app/api/webhook wrangler.*.jsonc __tests__/webhook-journal.test.ts
git commit -m "feat: journal Meta webhooks in R2"
```

### Task 2: Idempotent Queue consumer and Meta delivery services

**Files:**
- Create from current behavior: `lib/delivery/comment.ts`, `lib/delivery/postback.ts`, `lib/delivery/message.ts`, `lib/delivery/follow-up.ts`, `lib/delivery/errors.ts`
- Modify: `workers/jobs/index.ts`
- Create: `__tests__/jobs-consumer.test.ts`
- Adapt: `__tests__/dm-worker.test.ts`

**Interfaces:**
- `processInstagramJob(ctx: JobContext, job: InstagramJob): Promise<JobResult>`
- `JobResult = { status: "sent" | "skipped" | "retry" | "failed"; code: string }`
- Queue handler acknowledges successful/permanent outcomes and retries transient outcomes.

- [ ] **Step 1: Write failing consumer tests**

Cover first delivery, duplicate external ID, duplicate Meta side-effect key, no campaign match, disabled account, comment campaign, inbound DM campaign, public reply, postback, fallback, follow-up, transient Meta error, permanent Meta error, and Neon outage.

- [ ] **Step 2: Split the current 1,200-line worker by job kind**

Each new delivery module exports one function and receives dependencies
explicitly. Preserve existing matching, token decryption, tracked links,
public-reply variation, opening DM, next-reel, any-post, and DM keyword behavior.
Do not delete the legacy BullMQ modules until scheduled consumers have also
been ported in Task 6.

- [ ] **Step 3: Implement queue semantics**

For journal-backed message kinds: parse the contract, load the R2 envelope,
insert/find `ProcessedEvent`, mark delivery `PROCESSING`, execute once, persist
the terminal result, delete the R2 object, then acknowledge. For an internal
`FOLLOW_UP`, use its validated payload and deterministic external ID without an
R2 lookup. On transient failure, persist `RETRYING` and call
`message.retry({ delaySeconds })`. On permanent failure, persist `FAILED`,
delete any associated R2 object, and acknowledge.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run __tests__/jobs-consumer.test.ts __tests__/dm-worker.test.ts`

```powershell
git add lib/delivery workers/jobs __tests__/jobs-consumer.test.ts __tests__/dm-worker.test.ts
git commit -m "refactor: replace BullMQ with Queue consumer"
```

### Task 3: Follow-before-freebie enforcement

**Files:**
- Create: `lib/delivery/follow-gate.ts`
- Modify: `lib/delivery/comment.ts`
- Modify: `lib/delivery/postback.ts`
- Create: `__tests__/follow-gate.test.ts`

**Interfaces:**
- `checkFollowStatus(meta, instagramAccountId, userId): Promise<boolean>`
- `deliverFollowProtectedFreebie(ctx, input): Promise<JobResult>`

- [ ] **Step 1: Write failing follow-gate tests**

Test gate disabled, opening prompt, user clicks without following, user follows and clicks, repeated click after success, Meta follow-check transient failure, multiple matching campaigns, and no freebie call before positive Meta confirmation.

- [ ] **Step 2: Implement the gate**

Comment processing sends only the follow prompt when `requireFollowBeforeFreebie` is true. Postback processing calls Meta `is_user_follow_business` every attempt. A negative result sends the reminder; a positive result atomically reserves the delivery key and sends the freebie once.

- [ ] **Step 3: Verify and commit**

Run: `npx vitest run __tests__/follow-gate.test.ts`

```powershell
git add lib/delivery __tests__/follow-gate.test.ts
git commit -m "feat: enforce follow before freebie"
```

### Task 4: Per-account Durable Object rate limiter

**Files:**
- Create: `lib/jobs/account-rate-limit.ts`
- Create: `workers/jobs/account-rate-limiter.ts`
- Modify: `workers/jobs/index.ts`
- Modify: `wrangler.jobs.jsonc`
- Modify: `__tests__/rate-limiter.test.ts`

**Interfaces:**
- RPC `reserve(input: { amount: number; now: number }): Promise<{ allowed: boolean; retryAt: number | null; remaining: number }>`.
- One Durable Object instance ID per Instagram account ID.

- [ ] **Step 1: Rewrite tests against Durable Object behavior**

Cover atomic concurrent reservations, hourly reset, exact limit boundary, retry timestamp, separate-account isolation, and alarm cleanup.

- [ ] **Step 2: Implement SQLite-backed reservations**

Use one row per UTC hour with `used`. Execute read/check/update inside `blockConcurrencyWhile` or a SQLite transaction. Set an alarm after the active window so stale rows are deleted.

- [ ] **Step 3: Integrate delivery paths**

Reserve immediately before a Meta private/public reply. A denied reservation persists `RETRYING` and retries the Queue message at `retryAt`; it never marks the delivery permanently skipped merely because the current window is full.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run __tests__/rate-limiter.test.ts __tests__/jobs-consumer.test.ts`

```powershell
git add lib/jobs/account-rate-limit.ts workers/jobs wrangler.jobs.jsonc __tests__/rate-limiter.test.ts
git commit -m "feat: rate limit Instagram delivery with durable objects"
```

### Task 5: Delayed follow-ups and daily Queue budget

**Files:**
- Create: `lib/jobs/budget.ts`
- Modify: `lib/delivery/follow-up.ts`
- Modify: `workers/jobs/index.ts`
- Create: `__tests__/queue-budget.test.ts`

**Interfaces:**
- `reserveQueueJob(db, accountId, count): Promise<{ allowed: boolean; estimatedOperations: number }>`.
- Conservative daily ceiling: 9,500 estimated Queue operations.

- [ ] **Step 1: Write failing budget tests**

Cover three operations per normal message, an extra read per retry, UTC reset, 9,500 ceiling, essential versus optional jobs, and delay validation from 0 through 86,400 seconds.

- [ ] **Step 2: Implement budget accounting**

Increment `DailyAggregate.queueJobs` transactionally before producing optional jobs. Always accept verified inbound events into R2; if Queue budget is exhausted, leave their envelopes for recovery after the next UTC reset. Delay follow-ups in Queue and use a deterministic external ID.

- [ ] **Step 3: Verify and commit**

Run: `npx vitest run __tests__/queue-budget.test.ts`

```powershell
git add lib/jobs lib/delivery/follow-up.ts workers/jobs __tests__/queue-budget.test.ts
git commit -m "feat: enforce free queue budget"
```

### Task 6: Workflows and Cron Triggers

**Files:**
- Create: `workers/jobs/workflows/reconcile-account.ts`
- Create: `workers/jobs/workflows/refresh-tokens.ts`
- Create: `workers/jobs/workflows/attach-next-reel.ts`
- Create: `workers/jobs/workflows/snapshot-followers.ts`
- Create: `workers/jobs/workflows/retention.ts`
- Create: `workers/jobs/workflows/recover-journal.ts`
- Modify: `workers/jobs/index.ts`
- Modify: `wrangler.jobs.jsonc`
- Delete: `app/api/cron/`
- Delete: `vercel.json`
- Create: `__tests__/workflows.test.ts`

**Interfaces:**
- Hourly schedule invokes reconciliation and journal recovery.
- Daily schedules invoke token refresh, next-reel attachment, follower snapshot, and retention.
- Each run creates and finalizes a `JobRun` row.

- [ ] **Step 1: Write failing Workflow tests**

Test at most five account instances, skipped paused accounts, hourly recovery, identical Queue job contract for webhook and poll sources, bounded Meta pagination, per-step retry policy, daily task idempotency, and `JobRun` final state.

- [ ] **Step 2: Port reconciliation and daily cron logic**

Move logic from `lib/polling/comment-reconciler.ts` and `app/api/cron/*` into dependency-injected services called by Workflow steps. Reconciliation publishes jobs; it never sends Meta replies directly.

- [ ] **Step 3: Implement retention**

In bounded batches, aggregate rows older than the target day, then delete detailed `DmLog`, `ProcessedEvent`, and resolved `OperationalEvent` rows older than 90 days. Do not delete `DailyAggregate`, active failures, accounts, automations, follower snapshots, or tracked-link aggregates.

- [ ] **Step 4: Configure cron expressions**

Use UTC schedules: hourly reconciliation/recovery at minute 7, token refresh at 05:00, next reel at 06:00, follower snapshot at 07:00, and retention at 03:20. Record estimated Workflow steps before starting optional work.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run __tests__/workflows.test.ts`

```powershell
git add workers/jobs/workflows workers/jobs/index.ts wrangler.jobs.jsonc app/api/cron vercel.json lib/polling __tests__/workflows.test.ts
git commit -m "feat: move scheduled work to Cloudflare workflows"
```

### Task 7: Promote the CF-native schema and remove legacy runtime

**Files:**
- Replace: `prisma/schema.prisma` from `prisma/schema.cf-native.prisma`
- Replace: `prisma/migrations/` from `prisma/cf-native-migrations/`
- Delete: `prisma/schema.cf-native.prisma`
- Delete: `prisma/cf-native-migrations/`
- Delete: `lib/db/client.ts`
- Rename imports: `app/generated/cf-native` to `app/generated/prisma`
- Delete: `lib/queue/`
- Delete: `lib/utils/rate-limiter.ts`
- Delete: `lib/ops/worker-health.ts`
- Delete: `lib/polling/comment-reconciler.ts`
- Delete: `worker/`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `__tests__/legacy-removal.test.ts`

- [ ] **Step 1: Write a failing legacy-removal test**

Scan source and dependency manifests. Reject imports/references to
`app/generated/cf-native`, `@prisma/adapter-pg`, `pg`, `bullmq`, `ioredis`,
`next-auth`, `@auth/prisma-adapter`, `@vercel/analytics`, `REDIS_URL`,
`workspaceId`, and `npm run worker`.

- [ ] **Step 2: Promote the target schema**

Move the reviewed CF-native schema to `prisma/schema.prisma`, change its client
output to `../app/generated/prisma`, replace legacy migrations with the single
fresh initial migration, run `npx prisma generate`, and mechanically update
CF-native client imports.

- [ ] **Step 3: Remove legacy modules and packages**

Run:

```powershell
npm uninstall @prisma/adapter-pg pg bullmq ioredis @auth/prisma-adapter next-auth @vercel/analytics
```

Delete the old Node worker, Redis/BullMQ client, Redis rate limiter, Redis
heartbeat, and old polling implementation. Delete tests that exclusively assert
removed workspace, billing, Auth.js, or Redis behavior only after equivalent
Core/Jobs tests pass.

- [ ] **Step 4: Verify the clean cutover**

Run:

```powershell
npx vitest run __tests__/legacy-removal.test.ts
npx prisma validate
npm test
npm run typecheck
npm run lint
```

Expected: PASS with no legacy runtime dependency or schema reference.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json prisma lib worker __tests__
git commit -m "refactor: remove legacy node runtime"
```

### Task 8: Deployment automation, secrets, and final verification

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy-cloudflare.yml`
- Modify: `.env.example`
- Modify: `README.md`
- Replace: `docs/setup.md`
- Replace: `docs/stack.md`
- Delete: `docker-compose.yml`
- Delete: `worker/`
- Create: `docs/runbooks/recover-failed-jobs.md`
- Create: `docs/runbooks/rotate-admin-password.md`

- [ ] **Step 1: Extend CI gates**

CI runs `npm ci`, Prisma generate/validate, unit and Worker tests, typecheck, lint, OpenNext build, Core dry run, and Jobs dry run. It fails when any compressed Worker exceeds the Free bundle limit.

- [ ] **Step 2: Add manual production deployment workflow**

The workflow requires an explicit dispatch, runs `prisma migrate deploy` once, deploys Jobs, Core, then Web, and never logs secret values. Use GitHub environment protection for production.

- [ ] **Step 3: Document exact secrets and resources**

Document Neon `DATABASE_URL`, `ADMIN_LOGIN`, `ADMIN_PASSWORD_PEPPER`, `ADMIN_PASSWORD_VERIFIER`, `SESSION_SIGNING_KEY`, `ENCRYPTION_KEY`, Meta IDs/secrets, webhook token, R2 bucket, Queue/DLQ, Durable Object migrations, Workflow bindings, and custom routes.

- [ ] **Step 4: Run the full verification matrix**

Run:

```powershell
npm test
npm run typecheck
npm run lint
npx prisma validate
npm run cf:build:web
npx wrangler deploy --dry-run --config wrangler.web.jsonc
npx wrangler deploy --dry-run --config wrangler.core.jsonc
npx wrangler deploy --dry-run --config wrangler.jobs.jsonc
```

Expected: every command exits 0 and all bundles fit Free limits.

- [ ] **Step 5: Perform the Meta acceptance checklist**

On the test deployment verify comment DM, follow gate rejection, follow gate success exactly once, duplicate webhook, delayed follow-up, hourly recovery, token pause isolation, inbox, tracked link, public report, retention dry run, and admin logout.

- [ ] **Step 6: Commit and mark all plans complete**

```powershell
git add --all .github .env.example README.md docs docker-compose.yml
git commit -m "docs: add Cloudflare native deployment runbooks"
```

Change every completed checkbox in all four implementation plans to `[x]` and record final commit hashes. Do not push or change production Meta URLs until the user explicitly authorizes deployment.
