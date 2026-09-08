# InstaScaler audit, Polish and brand implementation plan

> Execute the approved tasks in this session, with independent audit domains delegated through dispatching-parallel-agents. Track completion here and evidence in docs/audits/.

**Goal:** Repair confirmed flow defects, provide a fully Polish interface and apply the existing DELTA240MVT brand.

**Architecture:** Preserve the existing three Workers and durable event delivery boundaries. Reuse semantic CSS and API clients. Test external dependencies through controlled fixtures and explicitly report live integration limits.

**Tech Stack:** Next.js 16, React 19, Hono, Prisma/Neon, Cloudflare, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-08-audit-polish-brand-design.md`

## Global constraints

Portal read-only; existing branch; no added services/localization dependencies; no production sends, deployment or push; preserve API identifiers/user content and unrelated artifacts. Read current Next docs and direct callers before editing. Tests for each functional regression.

## Task 1: Delivery audit

Files: workers/jobs/**, lib/delivery/**, lib/events/journal.ts, lib/jobs/**, lib/workflows/** and their tests.

- [x] Trace normalization → journal → queue → delivery → terminal cleanup; inspect all delivery variants and scheduled jobs.
- [x] Reproduce each confirmed defect in a focused Vitest test before minimal fix; exercise duplicates, pause, missing R2, transient/permanent failures and budgets.
- [x] Run focused files; record findings and limitations in docs/audits/2026-09-08-delivery.md.

## Task 2: Core audit

Files: workers/core/**, lib/core/**, lib/admin-auth/**, lib/automations/**, lib/meta/**, lib/tracking/** and focused tests.

- [x] Review each route and caller for auth/origin, validation, account ownership, OAuth, CRUD, inbox, read models, public reporting and tracking.
- [x] Add failing behavior regressions and minimal fixes. Keep machine-readable errors stable.
- [x] Run focused tests; record evidence in docs/audits/2026-09-08-core.md.

## Task 3: Polish dashboard and behavior

Files: app/(dashboard)/**, components/** except legal-shell/login, lib/templates/**, lib/core-api/**, lib/campaign-form.ts, client cache/import queue and relevant tests.

- [x] Translate visible and accessible labels, default templates, errors and formatters, retaining protocol fields.
- [x] Audit actual state transitions, selection, save/import, cache and error recovery; reproduce and fix defects.
- [x] Update language expectations and run focused tests; record evidence in docs/audits/2026-09-08-ui.md.

## Task 4: Shared brand, public pages and Web boundary

Files: app/globals.css, app/layout.tsx, app/login/**, app/{privacy,terms,data-deletion,meta-review,reports}/**, components/{legal-shell,admin-login-form}.tsx, app/api/[...path]/route.ts, lib/web-route-protection.ts, public/fonts/** and relevant tests.

- [x] Read local Next font/metadata/route-handler guidance, portal styles and licensed font assets. Verify Polish glyphs before copying fonts.
- [x] Apply approved palette/typography to semantic classes and translate public/login pages. Correct descriptions inconsistent with implemented architecture.
- [x] Test Web origin handling and invalid session recovery using real Request/Response behavior, then fix confirmed defects.
- [x] Add browser interaction coverage for Polish login, navigation, campaign creation/edit/import, inbox, settings, diagnostics and public reports using controlled API fixtures; retain separately gated live tests.

## Task 5: Integration and delivery

- [x] Review all diffs and cross-domain contracts; sweep remaining English/hardcoded old colors.
- [x] Run npm test, npm run typecheck, npm run lint, npm run cf:build:web, Core/Jobs dry-runs and configured browser tests. Record exact outcomes.
- [x] Inspect desktop/mobile renders, typography, overflow and keyboard behavior; fix observed failures and rerun affected checks.
- [x] Update README.md and INSTRUKCJA.md for Polish brand/testing instructions; record a flow/evidence/limitations matrix in docs/audits/2026-09-08-audit.md.
- [x] Run git diff --check and inspect changed files. Report completed work and any live Meta verification still requiring a test account.
