# Cloudflare Native Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute inline; do not use subagent-driven development.

**Goal:** Establish the Cloudflare project layout, direct Neon Serverless data layer, fresh single-owner schema, and shared contracts used by Web, Core, and Jobs Workers.

**Architecture:** Keep the existing Next.js application at the repository root and add two native Worker entrypoints under `workers/`. Shared code stays under `lib/`. Prisma uses `@prisma/adapter-neon`; migrations run only from CLI/CI.

**Tech Stack:** Next.js 16, TypeScript 5, Prisma 7, `@prisma/adapter-neon`, `@neondatabase/serverless`, Hono, Wrangler, Vitest.

## Global Constraints

- Cloudflare Workers Free and Neon Free only; no automatic paid overflow.
- One administrator and at most five Instagram accounts.
- Direct Neon Serverless connection; do not add Hyperdrive.
- Keep normalized detailed logs for 90 days and daily aggregates indefinitely.
- Use TDD, run focused tests before implementation, and commit each task.

---

### Task 1: Cloudflare dependencies and scripts

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `open-next.config.ts`
- Create: `wrangler.web.jsonc`
- Create: `wrangler.core.jsonc`
- Create: `wrangler.jobs.jsonc`

**Interfaces:**
- Produces scripts: `cf:build:web`, `cf:dev:core`, `cf:dev:jobs`, `cf:deploy:web`, `cf:deploy:core`, `cf:deploy:jobs`, `cf:typegen`.

- [x] **Step 1: Record the current baseline**

Run: `npm test && npm run typecheck && npm run lint`

Expected: all existing checks pass before dependency changes. Record any pre-existing failure in the plan execution notes.

> Execution note (2026-08-02): `npm test` (132 assertions) and `npm run lint` passed. Legacy `npm run typecheck` fails before this migration because the imported app has missing BullMQ/Recharts declaration files and existing old-app type errors. The new Cloudflare-native modules are validated separately while legacy code remains in place; the final cutover removes those legacy modules and restores a clean whole-project typecheck.

- [x] **Step 2: Install exact capability dependencies**

Run:

```powershell
npm install hono @neondatabase/serverless @prisma/adapter-neon
npm install --save-dev @opennextjs/cloudflare wrangler @cloudflare/vitest-pool-workers
```

Expected: lockfile contains the new packages. Keep legacy runtime dependencies
until the corresponding old code is removed in Plan 4.

- [x] **Step 3: Add scripts and minimal Worker configs**

Add these scripts to `package.json`:

```json
{
  "cf:build:web": "opennextjs-cloudflare build",
  "cf:dev:core": "wrangler dev --config wrangler.core.jsonc",
  "cf:dev:jobs": "wrangler dev --config wrangler.jobs.jsonc",
  "cf:deploy:web": "opennextjs-cloudflare deploy --config wrangler.web.jsonc",
  "cf:deploy:core": "wrangler deploy --config wrangler.core.jsonc",
  "cf:deploy:jobs": "wrangler deploy --config wrangler.jobs.jsonc",
  "cf:typegen": "wrangler types cloudflare-env.d.ts --config wrangler.jobs.jsonc"
}
```

Create `open-next.config.ts`:

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
```

Each Wrangler config must set `compatibility_date` to `2026-08-02`, enable `nodejs_compat`, enable observability, and point to its exact entrypoint. Bindings are added in later plans.

- [x] **Step 4: Verify configuration parsing**

Run: `npx wrangler deploy --dry-run --config wrangler.core.jsonc`

Expected: Wrangler parses the config; a missing entrypoint is the only acceptable failure until Task 4.

- [x] **Step 5: Commit** (`4181c55`)

```powershell
git add package.json package-lock.json open-next.config.ts wrangler.*.jsonc
git commit -m "build: add Cloudflare worker toolchain"
```

### Task 2: Fresh single-owner Prisma schema

**Files:**
- Create: `prisma/schema.cf-native.prisma`
- Create: `prisma/cf-native-migrations/20260802000000_initial/migration.sql`
- Create: `__tests__/schema-contract.test.ts`

**Interfaces:**
- Produces enums `DeliveryStatus`, `JobKind`, `JobStatus`, `EventSource`, `OperationalEventSource`, `OperationalEventLevel`.
- Produces models `InstagramAccount`, `Automation`, `ProcessedEvent`, `DmLog`, `TrackedLink`, `LinkClick`, `FollowerSnapshot`, `DailyAggregate`, `OperationalEvent`, `JobRun`.

- [x] **Step 1: Write the failing schema contract test**

The test reads `prisma/schema.cf-native.prisma` and asserts removed model names are absent, `workspaceId` is absent, `requireFollowBeforeFreebie Boolean @default(false)` exists, and every retained model listed above exists.

Run: `npx vitest run __tests__/schema-contract.test.ts`

Expected: FAIL because the current schema still contains workspace and NextAuth models.

- [x] **Step 2: Replace the schema**

Copy retained domain fields into the parallel schema, set its generator output
to `../app/generated/cf-native`, and remove all workspace/user relations. Keep
the active legacy schema unchanged until the final cutover. Add:

```prisma
model ProcessedEvent {
  id                 String      @id @default(cuid())
  externalId         String      @unique
  instagramAccountId String?
  source             EventSource
  kind               JobKind
  terminalStatus     JobStatus?
  r2Key              String?
  firstSeenAt        DateTime    @default(now())
  completedAt        DateTime?
  @@index([instagramAccountId, firstSeenAt])
}

model DailyAggregate {
  id                 String   @id @default(cuid())
  date               DateTime @db.Date
  instagramAccountId String
  received           Int      @default(0)
  sent               Int      @default(0)
  failed             Int      @default(0)
  skipped            Int      @default(0)
  queueJobs          Int      @default(0)
  workflowSteps      Int      @default(0)
  @@unique([date, instagramAccountId])
}
```

Use a `DeliveryStatus` enum containing `QUEUED`, `PROCESSING`, `SENT`, `SKIPPED`, `RETRYING`, and `FAILED`. Add indexes for retention queries on every detailed log timestamp.

- [x] **Step 3: Generate the fresh migration and client**

Run:

```powershell
npx prisma migrate diff --from-empty --to-schema prisma/schema.cf-native.prisma --script | Out-File -Encoding utf8 prisma/cf-native-migrations/20260802000000_initial/migration.sql
npx prisma generate --schema prisma/schema.cf-native.prisma
```

Expected: one initial SQL migration and generated Prisma client without removed workspace types.

- [x] **Step 4: Run schema test and validation**

Run: `npx prisma validate --schema prisma/schema.cf-native.prisma && npx vitest run __tests__/schema-contract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add prisma __tests__/schema-contract.test.ts
git commit -m "refactor: create single-owner database schema"
```

### Task 3: Request-scoped Neon Prisma factory

**Files:**
- Create: `lib/db/neon.ts`
- Create: `lib/db/types.ts`
- Create: `__tests__/db-client.test.ts`

**Interfaces:**
- Produces: `createPrisma(connectionString: string): PrismaClient`.
- Produces: `DatabaseEnv = { DATABASE_URL: string }`.

- [ ] **Step 1: Write the failing factory test**

Mock `PrismaNeon` and `PrismaClient`; assert one adapter is constructed with the supplied URL and that no module-level client is created.

Run: `npx vitest run __tests__/db-client.test.ts`

Expected: FAIL because the current module exports a global `prisma` proxy using `PrismaPg`.

- [ ] **Step 2: Implement the factory**

```ts
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/app/generated/cf-native/client";

export function createPrisma(connectionString: string): PrismaClient {
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}
```

Do not modify the legacy `lib/db/client.ts` yet and do not cache `Pool`,
`Client`, or Prisma objects across Worker invocations.

- [ ] **Step 3: Verify**

Run: `npx vitest run __tests__/db-client.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add lib/db/neon.ts lib/db/types.ts __tests__/db-client.test.ts
git commit -m "refactor: use Neon serverless Prisma adapter"
```

### Task 4: Shared Worker contracts and placeholder entrypoints

**Files:**
- Create: `lib/cloudflare/env.ts`
- Create: `lib/jobs/contracts.ts`
- Create: `workers/core/index.ts`
- Create: `workers/jobs/index.ts`
- Create: `__tests__/job-contracts.test.ts`

**Interfaces:**
- Produces discriminated union `InstagramJob` with kinds `COMMENT`, `POSTBACK`, `FOLLOW_UP`, `MESSAGE`, `RECOVER_R2`.
- Produces environment interfaces `CoreEnv` and `JobsEnv`.

- [ ] **Step 1: Write failing contract tests**

Test `parseInstagramJob(value: unknown)` for one valid payload per kind,
rejection of missing `externalId` or `instagramAccountId`, rejection of missing
`r2Key` on journal-backed kinds, and acceptance of a valid internal follow-up
without `r2Key`.

Run: `npx vitest run __tests__/job-contracts.test.ts`

Expected: FAIL because the contracts do not exist.

- [ ] **Step 2: Implement contracts with Zod**

Use one base schema:

```ts
const baseJobSchema = z.object({
  version: z.literal(1),
  externalId: z.string().min(1).max(255),
  instagramAccountId: z.string().min(1).max(255),
});
```

Extend `COMMENT`, `POSTBACK`, `MESSAGE`, and `RECOVER_R2` with
`r2Key: z.string().min(1).max(512)`. `FOLLOW_UP` is created internally and
instead carries `automationId`, `userId`, optional `commenterName`, and `dueAt`.
Export the inferred union plus `parseInstagramJob`.

- [ ] **Step 3: Add minimal entrypoints**

`workers/core/index.ts` returns JSON `{ status: "ok", service: "core" }` from `/health`. `workers/jobs/index.ts` exports a queue handler that logs batch size and acknowledges nothing explicitly.

- [ ] **Step 4: Verify dry runs and tests**

Run:

```powershell
npx vitest run __tests__/job-contracts.test.ts
npx wrangler deploy --dry-run --config wrangler.core.jsonc
npx wrangler deploy --dry-run --config wrangler.jobs.jsonc
```

Expected: PASS and both bundles report sizes below the Free limit.

- [ ] **Step 5: Commit**

```powershell
git add lib/cloudflare lib/jobs workers __tests__/job-contracts.test.ts
git commit -m "feat: add Cloudflare worker contracts"
```

### Task 5: Foundation checkpoint

- [ ] **Step 1: Run all checks**

Run: `npm test && npm run typecheck && npm run lint && npm run cf:build:web`

Expected: all checks pass because the legacy schema and dependencies remain
available during the parallel migration.

- [ ] **Step 2: Mark this plan complete**

Change every completed checkbox in this document from `[ ]` to `[x]` and record the final commit hash below this task.
