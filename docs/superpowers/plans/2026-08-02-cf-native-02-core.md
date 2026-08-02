# Cloudflare Core Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute inline; do not use subagent-driven development.

**Goal:** Replace Next.js route handlers and NextAuth with a secure native Core Worker that serves the private API, Instagram OAuth, webhook ingestion, reports, and tracked redirects.

**Architecture:** A Hono Worker creates request-scoped Prisma clients through the Neon adapter. Middleware owns sessions, origin checks, and uniform errors. Domain services are extracted from current route handlers without changing observable campaign behavior.

**Tech Stack:** Hono, Cloudflare Workers, Web Crypto, Prisma 7, Neon Serverless, Zod, Vitest.

## Global Constraints

- One administrator; no registration, users, workspaces, roles, email, or external login provider.
- Login is limited to five failures per 15 minutes.
- Protect every private API route; explicitly expose only health, login, Meta webhook/OAuth callback, tracked redirects, and shared reports.
- Direct Neon Serverless only; no Hyperdrive.
- Use TDD and commit each task.

---

### Task 1: Session and password primitives

**Files:**
- Create: `lib/admin-auth/password.ts`
- Create: `lib/admin-auth/session.ts`
- Create: `lib/admin-auth/cookies.ts`
- Create: `__tests__/admin-auth.test.ts`

**Interfaces:**
- `verifyAdminPassword(password, pepper, expectedVerifier): Promise<boolean>`
- `createSessionToken(now, ttlSeconds, signingKey): Promise<string>`
- `verifySessionToken(token, now, signingKey): Promise<{ exp: number } | null>`
- `SESSION_COOKIE = "__Host-instascaler-session"`

- [x] **Step 1: Write failing auth tests**

Cover valid/invalid HMAC verifier, tampered token, expired token, seven-day expiry, fixed cookie attributes, and malformed base64.

Run: `npx vitest run __tests__/admin-auth.test.ts`

Expected: FAIL because the modules do not exist.

- [x] **Step 2: Implement Web Crypto auth**

The password verifier is `base64url(HMAC-SHA-256(pepper, UTF8(password)))`. The session payload is versioned JSON `{ "v": 1, "exp": unixSeconds }` and its signature is HMAC-SHA-256 over the encoded payload. Compare decoded fixed-length signatures by XOR accumulation; never return early inside the byte loop.

Cookie output must be equivalent to:

```text
__Host-instascaler-session=<token>; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
```

- [x] **Step 3: Verify tests**

Run: `npx vitest run __tests__/admin-auth.test.ts`

Expected: PASS.

- [x] **Step 4: Commit** (`f3cd2a7`)

```powershell
git add lib/admin-auth __tests__/admin-auth.test.ts
git commit -m "feat: add single-admin session auth"
```

### Task 2: Login throttle Durable Object and auth middleware

**Files:**
- Create: `workers/core/login-throttle.ts`
- Create: `workers/core/middleware/auth.ts`
- Create: `workers/core/middleware/errors.ts`
- Modify: `workers/core/index.ts`
- Modify: `wrangler.core.jsonc`
- Create: `__tests__/core-auth.test.ts`

**Interfaces:**
- Durable Object RPC: `checkAndRecord(success: boolean): Promise<{ allowed: boolean; retryAfterSeconds: number }>`.
- Middleware context variable: `admin: true`.

- [x] **Step 1: Write failing middleware tests**

Test missing cookie `401`, invalid cookie `401`, valid cookie success, invalid Origin `403` on POST/PATCH/DELETE, five failed logins allowed, sixth rejected with `429`, and success clearing the failure window.

- [x] **Step 2: Implement the throttle**

Store timestamps in SQLite-backed Durable Object storage under `failures`. Remove values older than 900 seconds. Reject when five retained failures exist. Use the request IP-derived object ID so independent addresses do not block each other.

- [x] **Step 3: Add auth endpoints**

Implement:

```text
POST /api/auth/login   { login, password }
POST /api/auth/logout
GET  /api/auth/session
```

Read `ADMIN_LOGIN`, `ADMIN_PASSWORD_PEPPER`, `ADMIN_PASSWORD_VERIFIER`, and `SESSION_SIGNING_KEY` only from Worker secrets. Return generic `invalid_credentials`; never identify which field failed.

- [x] **Step 4: Verify**

Run: `npx vitest run __tests__/core-auth.test.ts && npx wrangler deploy --dry-run --config wrangler.core.jsonc`

Expected: PASS.

- [x] **Step 5: Commit** (`6153b37`)

```powershell
git add workers/core wrangler.core.jsonc __tests__/core-auth.test.ts
git commit -m "feat: protect core API with admin auth"
```

### Task 3: Single-owner campaign and account API

**Files:**
- Create: `workers/core/routes/automations.ts`
- Create: `workers/core/routes/instagram.ts`
- Create: `workers/core/routes/dashboard.ts`
- Create: `lib/automations/service.ts`
- Create: `lib/core/instagram-accounts.ts`
- Create: `lib/core/meta-oauth.ts`
- Create: `__tests__/core-automations.test.ts`
- Create: `__tests__/core-instagram.test.ts`

**Interfaces:**
- `GET|POST|PATCH|DELETE /api/automations`
- `POST /api/automations/import`
- `GET /api/dashboard/stats`
- `/api/instagram/{connect,callback,accounts,disconnect,profile,posts,overview,conversations}`

- [x] **Step 1: Write failing route tests**

Cover campaign CRUD, CSV import, account filtering, the five-account rejection `ACCOUNT_LIMIT_REACHED`, OAuth state signing, token encryption, and no `workspaceId` in request or response payloads.

- [x] **Step 2: Extract campaign service**

Move validation and persistence from `app/api/automations/route.ts` and `app/api/automations/import/route.ts` into functions accepting a Prisma transaction/client explicitly:

```ts
listAutomations(db, filter)
createAutomation(db, input)
updateAutomation(db, id, input)
deleteAutomation(db, id)
importAutomations(db, rows)
```

Keep every current campaign field, including `requireFollowBeforeFreebie`, opening DM, public reply variants, follow prompt, and follow-up delay capped at 1,440 minutes.

- [x] **Step 3: Port Instagram routes**

Implement new Core services without workspace resolution. Leave legacy
workspace modules in place until the Web migration removes their remaining
consumers. Enforce account count inside the same transaction that creates an
account. Preserve encrypted access tokens and Meta OAuth CSRF state.

- [x] **Step 4: Mount routes and verify**

Run: `npx vitest run __tests__/core-automations.test.ts __tests__/core-instagram.test.ts`

Expected: PASS.

- [x] **Step 5: Commit**

```powershell
git add workers/core/routes lib/automations lib/core __tests__/core-*.test.ts
git commit -m "feat: port single-owner campaign API"
```

### Task 4: Reports, logs, inbox, diagnostics, and redirects

**Files:**
- Create: `workers/core/routes/reports.ts`
- Create: `workers/core/routes/logs.ts`
- Create: `workers/core/routes/diagnostics.ts`
- Create: `workers/core/routes/redirects.ts`
- Create: `lib/core/reports.ts`
- Create: `lib/core/follower-history.ts`
- Create: `lib/core/report-share.ts`
- Create: `lib/core/tracked-redirect.ts`
- Create: `__tests__/core-read-models.test.ts`

**Interfaces:**
- `GET /api/logs`
- `GET /api/diagnostics`
- `GET /api/instagram/conversations` and `GET /api/instagram/conversations/:id`
- `GET /api/reports/:shareSlug`
- `GET /r/:slug`

- [x] **Step 1: Write failing read-model tests**

Test pagination, account filters, public report access without admin session, private log denial without session, unguessable share slugs, tracked-click insertion, and `404` for disabled reports or unknown links.

- [x] **Step 2: Port repository functions**

Port behavior into parallel Core modules. Every function accepts the generated
CF-native `PrismaClient | Prisma.TransactionClient`; none imports a module-global
database. Leave legacy modules until Plan 3/4 remove their consumers. Remove
workspace filters and preserve Instagram-account filters.

- [x] **Step 3: Replace Redis health with database job health**

Diagnostics must query `JobRun`, unresolved `OperationalEvent`, daily counters, last reconciliation per account, and:

```sql
SELECT pg_database_size(current_database()) AS bytes
```

Return storage warning `normal`, `warning` at 70%, or `critical` at 85% of 536,870,912 bytes.

- [x] **Step 4: Verify and commit**

Run: `npx vitest run __tests__/core-read-models.test.ts`

```powershell
git add workers/core/routes lib/core __tests__/core-read-models.test.ts
git commit -m "feat: port reports and diagnostics API"
```

### Task 5: Core API compatibility checkpoint

**Files:**
- Modify: `workers/core/index.ts`
- Create: `__tests__/core-contract.test.ts`

- [ ] **Step 1: Add a route contract test**

Assert all documented methods and paths are mounted, unknown `/api/*` returns JSON `404`, thrown validation errors return `400`, unauthenticated private routes return `401`, and unexpected errors return a request ID without stack traces.

- [ ] **Step 2: Confirm legacy handlers are no longer authoritative**

Keep legacy handlers temporarily so the old Web build stays green. Production
route configuration must send `/api/*` and `/r/*` to Core. Plan 3 deletes the
legacy handlers after removing their remaining imports. Webhook and cron
handlers are removed in Plan 4.

- [ ] **Step 3: Run the Core checkpoint**

Run:

```powershell
npx vitest run __tests__/admin-auth.test.ts __tests__/core-*.test.ts
npx wrangler deploy --dry-run --config wrangler.core.jsonc
npm run typecheck
```

Expected: PASS and bundle below the Free script-size limit.

- [ ] **Step 4: Commit and mark plan complete**

```powershell
git add workers/core __tests__/core-contract.test.ts
git commit -m "refactor: complete native core worker"
```

Change all completed checkboxes in this document to `[x]` and record the commit hash.
