# Premium Light UIX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute inline; the user explicitly requested no subagent-driven development.

**Goal:** Deliver a production-ready premium light interface across every OpenReply administrator surface, with complete mobile behavior from login through campaign and inbox workflows.

**Architecture:** Preserve all data fetching and API contracts. Establish design tokens and dependency-free primitives first, then apply them through shared shell components and page-specific layouts. Keep responsive behavior in semantic CSS/component boundaries so pages remain understandable and business logic stays untouched.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, TypeScript, inline SVG, Vitest, Playwright, OpenNext Cloudflare

## Global Constraints

- No backend, API, database or Meta behavior changes.
- No paid service, UI framework, icon package, animation framework or theme dependency.
- Premium light only: warm canvas, white surfaces, deep ink text, restrained indigo accent.
- Support 320, 375, 768, 1024 and 1440px without horizontal page overflow.
- Mobile interactive targets are at least 44px and inputs remain at least 16px.
- Preserve visible keyboard focus, semantic labels, non-color status cues and reduced-motion support.
- Keep the untracked `docs/cloudflare-native-hosting.md` untouched.
- Finish with tests, commit, push and deploy Jobs → Core → Web from synchronized HEAD.

---

### Task 1: Design tokens and reusable primitives

**Files:**
- Modify: `app/globals.css`
- Create: `components/ui-icons.tsx`
- Modify: `components/stat-card.tsx`
- Modify: `components/status-badge.tsx`
- Modify: `components/account-select.tsx`
- Test: `__tests__/ui-contract.test.ts`

**Interfaces:**
- Produces semantic classes `.app-card`, `.app-card-interactive`, `.app-button`, `.app-button-primary`, `.app-button-secondary`, `.app-button-danger`, `.app-field`, `.app-label`, `.app-kicker`, `.app-page-title`, `.app-page-description`, `.app-skeleton`.
- Produces `Icon({ name, size?, className? })` with a closed `IconName` union.
- Existing component props remain source-compatible.

- [x] **Step 1: Write the visual contract test**

Add source-level assertions that tokens, mobile field sizing, reduced motion, button classes and icon names exist. The test must import no DOM renderer:

```ts
const css = readFileSync(resolve("app/globals.css"), "utf8");
expect(css).toContain(".app-button-primary");
expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]*font-size: 16px/);
expect(readFileSync(resolve("components/ui-icons.tsx"), "utf8")).toContain('export type IconName');
```

- [x] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run __tests__/ui-contract.test.ts`

Expected: FAIL because semantic premium primitives do not exist.

- [x] **Step 3: Implement tokens and primitives**

Define the selected palette, typography scale, shadows, radii, transitions and semantic classes. Build an SVG icon map for navigation, actions, status and password visibility. Upgrade shared metric, status and account controls to consume the semantic classes.

- [x] **Step 4: Verify the foundation**

Run: `npx vitest run __tests__/ui-contract.test.ts __tests__/campaign-builder-contract.test.ts && npm run typecheck && npm run lint`

Expected: all commands pass without errors.

- [x] **Step 5: Commit**

```bash
git add app/globals.css components/ui-icons.tsx components/stat-card.tsx components/status-badge.tsx components/account-select.tsx __tests__/ui-contract.test.ts
git commit -m "feat: add premium light design system"
```

### Task 2: Responsive shell and mobile-perfect login

**Files:**
- Modify: `components/sidebar.tsx`
- Modify: `components/top-bar.tsx`
- Modify: `components/dashboard-shell.tsx`
- Modify: `app/login/page.tsx`
- Modify: `components/admin-login-form.tsx`
- Modify: `__tests__/web-auth.test.ts`
- Modify: `__tests__/ui-contract.test.ts`

**Interfaces:**
- Sidebar remains `Sidebar({ isOpen, onClose })`.
- Top bar remains source-compatible with existing account props.
- Add pure `passwordInputType(visible: boolean): "text" | "password"` only if a testable helper is useful; login API behavior remains unchanged.

- [x] **Step 1: Extend failing contracts**

Assert the login retains correct callback sanitization, exposes password visibility semantics, the mobile sidebar has dialog labeling and shell uses `dvh`, touch targets and responsive gutters.

- [x] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run __tests__/web-auth.test.ts __tests__/ui-contract.test.ts`

Expected: at least the new visual/mobile assertions fail.

- [x] **Step 3: Implement the shell**

Create a compact brand block, icon navigation, active indicator, system footer, polished account status and accessible mobile drawer. Close the drawer on navigation, keep sticky top context and prevent content overflow.

- [x] **Step 4: Implement login**

Create a premium two-column wide layout with a focused mobile card, private workspace copy, branded mark, secure sign-in note, 44px controls, show/hide password and in-button progress indicator. Preserve username/password autocomplete and inline errors.

- [x] **Step 5: Verify login and shell**

Run: `npx vitest run __tests__/web-auth.test.ts __tests__/ui-contract.test.ts && npm run typecheck && npm run lint`

Expected: all pass.

- [x] **Step 6: Commit**

```bash
git add components/sidebar.tsx components/top-bar.tsx components/dashboard-shell.tsx app/login/page.tsx components/admin-login-form.tsx __tests__/web-auth.test.ts __tests__/ui-contract.test.ts
git commit -m "feat: polish navigation and login UIX"
```

### Task 3: Dashboard, overview and report hierarchy

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `app/(dashboard)/overview/page.tsx`
- Modify: `components/follower-chart.tsx`
- Modify: `app/reports/[shareSlug]/page.tsx`
- Modify: `__tests__/ui-contract.test.ts`

**Interfaces:**
- Dashboard and report API shapes remain unchanged.
- `FollowerChart` retains its existing public props.

- [x] **Step 1: Add page hierarchy contracts**

Assert dashboard has a primary campaign CTA and semantic page heading, overview uses the shared follower chart, and public reports use the branded public shell.

- [x] **Step 2: Run the contract test and confirm failure**

Run: `npx vitest run __tests__/ui-contract.test.ts`

- [x] **Step 3: Recompose dashboard and overview**

Create a clear welcome block, account context, premium metric grid, balanced chart/activity layout, purposeful empty states and shaped skeletons. Convert follower history to the chart component with mobile horizontal safety.

- [x] **Step 4: Polish public reports**

Apply the same typography, cards, status and responsive spacing without administrator navigation or private actions.

- [x] **Step 5: Verify and commit**

Run: `npx vitest run __tests__/ui-contract.test.ts __tests__/core-read-models.test.ts && npm run typecheck && npm run lint`

```bash
git add app/(dashboard)/dashboard/page.tsx app/(dashboard)/overview/page.tsx components/follower-chart.tsx app/reports/[shareSlug]/page.tsx __tests__/ui-contract.test.ts
git commit -m "feat: refine analytics experience"
```

### Task 4: Campaign discovery and creation flow

**Files:**
- Modify: `app/(dashboard)/campaigns/page.tsx`
- Modify: `components/campaign-builder.tsx`
- Modify: `components/campaign-preview.tsx`
- Modify: `components/keyword-input.tsx`
- Modify: `components/post-picker.tsx`
- Modify: `app/(dashboard)/campaigns/import/page.tsx`
- Modify: `app/(dashboard)/campaigns/[id]/page.tsx`
- Modify: `__tests__/campaign-builder-contract.test.ts`
- Modify: `__tests__/ui-contract.test.ts`

**Interfaces:**
- Preserve the complete existing campaign payload and form submission behavior.
- Preserve `CampaignPreview`, `KeywordInput` and `PostPicker` public props.

- [x] **Step 1: Add failing mobile/action contracts**

Assert builder navigation, sticky action region, explicit labels, touch-safe toggles and campaign-card action labels exist without changing contract defaults.

- [x] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run __tests__/campaign-builder-contract.test.ts __tests__/ui-contract.test.ts`

- [x] **Step 3: Polish campaign list**

Create a premium page header, search/filter toolbar, responsive cards, clear active/paused hierarchy, stronger media treatment, compact analytics and an accessible action menu. Add useful empty/loading states.

- [x] **Step 4: Polish builder and detail surfaces**

Group fields into concise cards, make labels/helper text consistent, clarify triggers and follow gate, improve post/keyword selection, keep preview secondary and add a mobile-safe sticky save area.

- [x] **Step 5: Polish import**

Improve drop/select affordance, instructions, validation summary and responsive result presentation while preserving CSV behavior.

- [x] **Step 6: Verify and commit**

Run: `npx vitest run __tests__/campaign-builder-contract.test.ts __tests__/csv.test.ts __tests__/ui-contract.test.ts && npm run typecheck && npm run lint`

```bash
git add app/(dashboard)/campaigns components/campaign-builder.tsx components/campaign-preview.tsx components/keyword-input.tsx components/post-picker.tsx __tests__/campaign-builder-contract.test.ts __tests__/ui-contract.test.ts
git commit -m "feat: elevate campaign workflows"
```

### Task 5: Inbox and activity operations

**Files:**
- Modify: `app/(dashboard)/inbox/page.tsx`
- Modify: `app/(dashboard)/logs/page.tsx`
- Modify: `__tests__/ui-contract.test.ts`

**Interfaces:**
- Polling, cache keys, message API calls and send behavior remain unchanged.
- Add only presentational state needed to switch list/thread panes on small screens.

- [ ] **Step 1: Add failing responsive inbox contracts**

Assert a mobile thread back action, sticky composer, labeled conversation region, message status treatment and responsive logs presentation.

- [ ] **Step 2: Run contract test and confirm failure**

Run: `npx vitest run __tests__/ui-contract.test.ts`

- [ ] **Step 3: Implement inbox responsive behavior**

Keep the desktop split view. On phones show the conversation list or active thread, never both; provide a 44px back action, sticky thread header, readable bubbles and a composer that remains usable above the virtual keyboard.

- [ ] **Step 4: Polish logs**

Apply consistent filter controls, status pills, empty/loading/error states and switch dense table rows to readable mobile cards when required.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run __tests__/ui-contract.test.ts __tests__/core-read-models.test.ts && npm run typecheck && npm run lint`

```bash
git add app/(dashboard)/inbox/page.tsx app/(dashboard)/logs/page.tsx __tests__/ui-contract.test.ts
git commit -m "feat: perfect inbox and activity UIX"
```

### Task 6: Settings, diagnostics and public consistency

**Files:**
- Modify: `app/(dashboard)/settings/page.tsx`
- Modify: `app/(dashboard)/diagnostics/page.tsx`
- Modify: `components/instagram-connect-notice.tsx`
- Modify: `components/legal-shell.tsx`
- Modify: `app/meta-review/page.tsx`
- Modify: `__tests__/ui-contract.test.ts`

**Interfaces:**
- Preserve reconnect, replay, logout and disconnect behavior.
- Legal/public content remains unchanged except layout and presentation.

- [ ] **Step 1: Add operational hierarchy contracts**

Assert reconnect warnings, budget progress, replay actions, destructive separation, legal shell branding and mobile action targets.

- [ ] **Step 2: Run contract test and confirm failure**

Run: `npx vitest run __tests__/ui-contract.test.ts`

- [ ] **Step 3: Polish settings and diagnostics**

Create account identity cards, strong connection state, separated administrator session area, scannable budgets/incidents/jobs and clear replay affordances. Preserve every operational value.

- [ ] **Step 4: Align public/legal surfaces**

Apply the brand mark, readable article width, restrained navigation and consistent footer to legal and Meta review pages.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run __tests__/ui-contract.test.ts __tests__/core-contract.test.ts && npm run typecheck && npm run lint`

```bash
git add app/(dashboard)/settings/page.tsx app/(dashboard)/diagnostics/page.tsx components/instagram-connect-notice.tsx components/legal-shell.tsx app/meta-review/page.tsx __tests__/ui-contract.test.ts
git commit -m "feat: polish operational surfaces"
```

### Task 7: Production mobile QA, review and deployment

**Files:**
- Modify if required by findings: UI files from Tasks 1–6
- Modify: `docs/superpowers/reviews/2026-08-02-cloudflare-native-production-review.md`
- Modify: `docs/superpowers/plans/2026-08-02-premium-light-uix.md`

**Interfaces:**
- Produces a synchronized Git branch and deployed Cloudflare stack.

- [ ] **Step 1: Run the complete local matrix**

```bash
npm test
npm run typecheck
npm run lint
npx prisma validate
npx playwright test --list
npm audit --audit-level=high
npm run cf:build:web
npx wrangler deploy --dry-run --outdir dist/web --config wrangler.web.jsonc
npx wrangler deploy --dry-run --outdir dist/core --config wrangler.core.jsonc
npx wrangler deploy --dry-run --outdir dist/jobs --config wrangler.jobs.jsonc
node scripts/check-worker-size.mjs dist/web dist/core dist/jobs
git diff --check
```

Expected: all tests and checks pass; all gzip sizes remain below 3 MiB.

- [ ] **Step 2: Perform source-level mobile review**

Confirm all administrator pages use responsive padding, no fixed content width below 320px, forms use visible labels, actions are touch-safe, inbox has one-pane mobile behavior, login has no overflow and reduced-motion rules remain intact.

- [ ] **Step 3: Update review and checkboxes**

Record the final test count, bundle sizes, UIX review findings and deployment smoke results. Change every completed checkbox in this plan to `[x]`.

- [ ] **Step 4: Commit and push**

```bash
git add docs/superpowers/reviews/2026-08-02-cloudflare-native-production-review.md docs/superpowers/plans/2026-08-02-premium-light-uix.md
git commit -m "docs: complete premium UIX review"
git push
```

- [ ] **Step 5: Deploy synchronized HEAD**

```bash
npm run cf:deploy:jobs
npm run cf:deploy:core
npm run cf:deploy:web
```

Expected: each command returns a new Cloudflare version ID.

- [ ] **Step 6: Production smoke from terminal**

Verify Web `/login` returns 200 with the login form, Core `/health` returns `{status:"ok"}`, Jobs `/health` returns `{status:"ok"}`, and local HEAD equals `origin/baza020826-cf-native`.
