# Cloudflare OpenNext Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute inline; do not use subagent-driven development.

**Goal:** Convert the existing Next.js application into a thin OpenNext Web Worker that renders the retained product UI and communicates only through the Core API.

**Architecture:** Server and client pages use one typed API client instead of importing Prisma or domain repositories. The Web Worker owns presentation and route protection; the Core Worker remains the authority for sessions and data.

**Tech Stack:** Next.js 16, React 19, OpenNext Cloudflare adapter, Tailwind CSS 4, Vitest, Playwright.

## Global Constraints

- Keep the current private dashboard behavior and branding.
- Keep legal pages and public reports; remove public marketing/SEO/template pages.
- Web bundle must not include Prisma, Neon, Meta processing, Queue, or Workflow code.
- Session cookie is issued by Core and honored by Web route protection.
- Use TDD and commit each task.

---

### Task 1: Typed Core API client

**Files:**
- Create: `lib/core-api/client.ts`
- Create: `lib/core-api/contracts.ts`
- Create: `lib/core-api/errors.ts`
- Create: `__tests__/core-api-client.test.ts`

**Interfaces:**
- `createCoreApi(options: { baseUrl: string; cookie?: string; fetch?: typeof fetch }): CoreApi`
- `CoreApiError` with `status`, `code`, and `requestId`.

- [x] **Step 1: Write failing client tests**

Test cookie forwarding on server calls, relative browser requests, JSON error parsing, `204` handling, query-string encoding, and abort propagation.

- [x] **Step 2: Implement one transport**

All methods call a private `request<T>(path, init)` function. Expose typed methods for session, stats, accounts, automations, imports, posts, overview, inbox, logs, diagnostics, and reports. Do not duplicate `fetch` wrappers inside page components.

- [x] **Step 3: Verify and commit**

Run: `npx vitest run __tests__/core-api-client.test.ts`

```powershell
git add lib/core-api __tests__/core-api-client.test.ts
git commit -m "feat: add typed core API client"
```

### Task 2: Login UI and route protection

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `proxy.ts`
- Delete: `app/api/auth/`
- Delete: `lib/auth.ts`
- Delete: `types/next-auth.d.ts`
- Delete: `app/verify-request/page.tsx`
- Delete: `components/invitation-accept-card.tsx`
- Create: `components/admin-login-form.tsx`
- Create: `__tests__/web-auth.test.ts`

**Interfaces:**
- Login submits `{ login, password }` to `/api/auth/login`.
- Protected prefixes include every dashboard route, campaigns, automations, inbox, logs, diagnostics, and settings.

- [x] **Step 1: Write failing auth UI tests**

Test empty validation, invalid-credential message, throttled message with retry time, callback URL restricted to local paths, logout, and redirect from protected routes without the `__Host-instascaler-session` cookie.

- [x] **Step 2: Replace Auth.js UI**

Render only login and password inputs. Remove email copy, magic-link state, OAuth provider UI, and verification page. Submit credentials through the typed client and redirect to a validated local callback or `/dashboard`.

- [x] **Step 3: Update proxy cookie detection**

Accept only `__Host-instascaler-session`. Presence is an optimistic routing hint; Core still verifies the signature for every API request.

- [x] **Step 4: Verify and commit**

Run: `npx vitest run __tests__/web-auth.test.ts && npm run typecheck`

```powershell
git add app/login app/verify-request app/api/auth lib/auth.ts types/next-auth.d.ts components/admin-login-form.tsx components/invitation-accept-card.tsx proxy.ts __tests__/web-auth.test.ts
git commit -m "refactor: replace magic link with admin login"
```

### Task 3: Remove direct database access from dashboard layouts and pages

**Files:**
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `app/(dashboard)/overview/page.tsx`
- Modify: `app/(dashboard)/automations/page.tsx`
- Modify: `app/(dashboard)/campaigns/**/*.tsx`
- Modify: `app/(dashboard)/inbox/page.tsx`
- Modify: `app/(dashboard)/logs/page.tsx`
- Modify: `app/(dashboard)/diagnostics/page.tsx`
- Modify: `app/(dashboard)/settings/page.tsx`
- Modify: `components/account-select.tsx`
- Modify: `components/campaign-builder.tsx`
- Delete: `app/api/workspace/`
- Delete: `lib/workspace.ts`
- Delete: `lib/workspace-access.ts`
- Delete: `lib/workspace-invitations.ts`
- Delete: `lib/billing/usage.ts`
- Create: `__tests__/web-no-server-imports.test.ts`

**Interfaces:**
- Pages consume only `CoreApi` contracts.
- Selected Instagram account remains a URL query parameter or browser preference, not workspace state.

- [x] **Step 1: Write the failing import-boundary test**

Scan `app/` and `components/` and reject imports from `lib/db`, `app/generated/prisma`, `lib/workspace*`, `lib/billing`, `lib/queue`, and `lib/meta`.

Run: `npx vitest run __tests__/web-no-server-imports.test.ts`

Expected: FAIL on current server-rendered pages.

- [x] **Step 2: Convert dashboard data access**

Replace Prisma calls in layouts/pages with server-side Core API calls that forward the request cookie. Client polling pages use relative `/api/*` URLs routed to Core. Preserve loading, empty, unauthorized, and error states.

- [x] **Step 3: Remove workspace UI assumptions**

Delete team/member/invitation controls, workspace names, legacy workspace API
routes, and their now-unused modules. Account selection operates directly on
the up-to-five Instagram accounts. Settings shows administrator logout plus
Instagram account connection state.

- [x] **Step 4: Verify and commit**

Run: `npx vitest run __tests__/web-no-server-imports.test.ts && npm run typecheck`

```powershell
git add app components lib/workspace.ts lib/workspace-access.ts lib/workspace-invitations.ts lib/billing/usage.ts __tests__/web-no-server-imports.test.ts
git commit -m "refactor: make web UI consume core API"
```

### Task 4: Retain follow-gate and campaign capabilities

**Files:**
- Modify: `components/campaign-builder.tsx`
- Modify: `components/campaign-preview.tsx`
- Modify: `app/(dashboard)/campaigns/[id]/page.tsx`
- Create: `__tests__/campaign-builder-contract.test.ts`

**Interfaces:**
- API field: `requireFollowBeforeFreebie: boolean`.
- Follow prompt fields remain `followPromptMessage` and `followPromptButtonLabel`.
- Follow-up delay remains integer minutes from 0 through 1,440.

- [x] **Step 1: Write failing builder contract tests**

Test serialization and restoration of every campaign field, with special coverage for follow gate, opening DM, link button, public reply variants, next reel, any post, inbound DM trigger, and delayed follow-up.

- [x] **Step 2: Align UI with the new contract**

Rename the current `requireFollow` transport field to `requireFollowBeforeFreebie`, retain current labels, and explain that Meta verifies follow when the user presses the confirmation button.

- [x] **Step 3: Verify and commit**

Run: `npx vitest run __tests__/campaign-builder-contract.test.ts`

```powershell
git add components/campaign-* 'app/(dashboard)/campaigns' __tests__/campaign-builder-contract.test.ts
git commit -m "feat: preserve follow-gated campaign builder"
```

### Task 5: Remove excluded public and team surfaces

**Files:**
- Replace: `app/page.tsx`
- Delete: `app/comment-link-automation/`
- Delete: `app/instagram-comment-to-dm-templates/`
- Delete: `app/instagram-dm-automation-agencies/`
- Delete: `app/manychat-alternative/`
- Delete: `app/templates/`
- Delete: `app/invite/`
- Delete: `components/public-site-header.tsx`
- Delete: `components/seo-page-shell.tsx`
- Delete: `components/template-visual.tsx`
- Delete: `lib/seo-pages.ts`
- Delete: `app/api/automations/`
- Delete: `app/api/dashboard/`
- Delete: `app/api/instagram/`
- Delete: `app/api/logs/`
- Delete: `app/api/admin/`
- Delete: `app/api/health/`
- Delete: `app/r/`
- Modify: `app/privacy/page.tsx`
- Modify: `app/terms/page.tsx`
- Modify: `app/data-deletion/page.tsx`
- Modify: `app/meta-review/page.tsx`
- Create: `__tests__/public-route-scope.test.ts`

- [x] **Step 1: Write the route-scope test**

Assert removed routes have no page files and required legal/report routes exist. Assert `/` redirects authenticated users to `/dashboard` and unauthenticated users to `/login`.

- [x] **Step 2: Delete excluded surfaces and stale imports**

Keep campaign templates only as private builder data in `lib/templates/campaign-templates.ts`. Remove public SEO metadata that names deleted routes.

- [x] **Step 3: Verify and commit**

Run: `npx vitest run __tests__/public-route-scope.test.ts && npm run lint && npm run typecheck`

```powershell
git add app components lib __tests__/public-route-scope.test.ts
git commit -m "refactor: remove public marketing and team UI"
```

### Task 6: OpenNext build and browser checkpoint

**Files:**
- Modify: `next.config.ts`
- Modify: `wrangler.web.jsonc`
- Create: `e2e/admin-flow.spec.ts`
- Create: `playwright.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

- [x] **Step 1: Add Playwright and a failing smoke flow**

The flow logs in, views dashboard, switches account, creates a follow-gated campaign, opens diagnostics, logs out, and confirms a shared report remains public.

- [x] **Step 2: Configure OpenNext production settings**

Keep `nodejs_compat`, configure static assets, and ensure Web calls the same-domain Core routes. Remove Vercel Analytics imports.

- [x] **Step 3: Verify Web Worker**

Run:

```powershell
npm test
npm run typecheck
npm run lint
npm run cf:build:web
npx wrangler deploy --dry-run --config wrangler.web.jsonc
```

Expected: PASS and compressed Worker bundle below the Free limit.

- [x] **Step 4: Commit and mark plan complete**

```powershell
git add next.config.ts wrangler.web.jsonc e2e playwright.config.ts package.json package-lock.json
git commit -m "feat: complete OpenNext web worker"
```

Change all completed checkboxes in this document to `[x]` and record the commit hash.
