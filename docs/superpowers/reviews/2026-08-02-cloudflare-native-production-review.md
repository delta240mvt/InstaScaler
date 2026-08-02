# Cloudflare-native production review

Reviewed against `docs/superpowers/specs/2026-08-02-cloudflare-native-design.md`,
`docs/superpowers/specs/2026-08-02-premium-light-uix-design.md` and all five
implementation plans.

## Premium light UIX

- [x] The light ink/paper palette, indigo accent, spacing, radii, focus states and shaped skeletons are centralized as semantic primitives.
- [x] Login is password-manager friendly, keyboard accessible and responsive at 320px with visible labels, password reveal and submit/error feedback.
- [x] Desktop navigation and the labeled mobile drawer share grouped icon navigation, connection context and touch-safe controls.
- [x] Dashboard, overview, follower chart and public reports use a consistent hierarchy and responsive metric layouts.
- [x] Campaign discovery, import, editing, preview and detail views preserve every API field while adding touch-safe actions and keyboard-openable cards.
- [x] Inbox uses one pane at a time on phones, with a 44px back action and a sticky safe-area composer; desktop retains the split view.
- [x] Logs switch from a dense table to mobile cards. Settings, diagnostics, legal and Meta review surfaces use the same responsive light system.
- [x] Source review confirmed responsive gutters, 16px mobile inputs, 44px primary targets, reduced-motion handling, semantic labels and no fixed page width below 320px.

The two-axis code review found no remaining standards or specification blockers.
During review, keyboard access for campaign cards, toggle hit areas and short-
viewport inbox sizing were identified and corrected before release.

## Architecture and scope

- [x] Web, Core and Jobs are independently deployable Workers.
- [x] Neon uses the serverless adapter directly; Hyperdrive, Redis and BullMQ are absent.
- [x] Authentication is single-administrator login/password with no registration or email flow.
- [x] Workspace, billing, public marketing and legacy Next.js API surfaces are removed.
- [x] The database starts from one fresh Cloudflare-native migration.

## Reliability and Free-plan controls

- [x] Webhooks are signature-verified and journaled to R2 before Queue publication.
- [x] Processed events and Meta delivery side effects have deterministic unique keys.
- [x] Failed envelopes remain in R2 for authenticated manual replay.
- [x] Queue retries use bounded exponential backoff and reserve the extra read operation.
- [x] One atomic global budget stops Queue, inbound and Workflow work below conservative daily ceilings across all five accounts; per-account counters remain diagnostic only.
- [x] Reconciliation remains hourly and is bounded to five accounts and 100 comments per media.
- [x] A singleton Durable Object alarm starts Workflows hourly without paid direct Workflow schedules or scarce account-level Cron Trigger slots.
- [x] Per-account Durable Object capacity is persisted in SQLite.
- [x] Detailed terminal records expire after 90 days; daily aggregates remain.

## Product behavior

- [x] Campaign CRUD/import supports post, any-post, next-reel, comment and DM triggers.
- [x] Follow-gated freebie delivery checks Meta at every confirmation and reserves delivery before sending.
- [x] Opening messages, public replies, two tracked links and delayed follow-ups are retained.
- [x] Inbox read/reply, tracked redirects, follower history and public reports have complete API/UI paths.
- [x] Expired/invalid permissions pause only the affected account and expose reconnect state.
- [x] Diagnostics exposes account state, budgets, Workflow runs, operational errors and manual replay.

## Security

- [x] Session cookies are host-only, HttpOnly, Secure and SameSite=Strict.
- [x] Invalid cookies are cleared and every dashboard shell verifies the Core session.
- [x] All unsafe browser API calls require an exact same-origin header.
- [x] Nested diagnostics and report-management endpoints have explicit administrator middleware.
- [x] OAuth state, access-token encryption, webhook HMAC and tracked-click IP hashing use Web Crypto.
- [x] Staged changes contain placeholders only and no live credentials.

## Verification and release

- [x] All 152 unit/contract tests across 29 files, typecheck, lint, Prisma validation and dependency audit pass.
- [x] Playwright production scenarios are discoverable and ready for live credentials.
- [x] OpenNext, Core and Jobs production bundles build and pass Cloudflare dry-run validation.
- [x] Core starts in the local Cloudflare `workerd` runtime and returns `200` from `/health`.
- [x] Bundle-size gates remain below the Workers Free compressed limit.
- [x] Final compressed artifacts are Web 1.39 MiB, Core 0.27 MiB and Jobs 0.26 MiB, each below the 3 MiB gate.
- [x] Production Queue, dead-letter Queue and R2 journal resources exist in Cloudflare.
- [x] Web, Core, Jobs, six Workflows and both Durable Objects are deployed on the Free account.
- [x] The hourly Durable Object alarm is armed; deployed Web login and both health endpoints return `200`.
- [x] Premium UIX release deployed as Jobs `a392484d-893f-495e-86c1-14a61c5130d3`, Core `fa0b3a05-4b2b-45bf-8703-9548351d9105` and Web `4091f2d2-96d8-44c3-8094-7fc6d4fb0c66`.
- [x] Terminal smoke confirmed the Web login contains the sign-in form and Core/Jobs both return their expected `{status:"ok"}` health payloads.
- [ ] Apply the migration to the supplied Neon database.
- [ ] Configure Cloudflare admin, Neon and Meta secrets.
- [ ] Run browser and dedicated Meta acceptance tests on the deployed stack.
- [ ] Configure final custom-domain routes and update Meta callback URLs.

The unchecked items require the Neon connection string, Meta application values, an
administrator password and the final hostname. They are deployment configuration and
live acceptance work, not missing implementation.
