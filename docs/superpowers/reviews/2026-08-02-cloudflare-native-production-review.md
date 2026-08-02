# Cloudflare-native production review

Reviewed against `docs/superpowers/specs/2026-08-02-cloudflare-native-design.md`
and all four implementation plans.

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

- [x] All 135 unit/contract tests, typecheck, lint, Prisma validation and dependency audit pass.
- [x] Playwright production scenarios are discoverable and ready for live credentials.
- [x] OpenNext, Core and Jobs production bundles build and pass Cloudflare dry-run validation.
- [x] Core starts in the local Cloudflare `workerd` runtime and returns `200` from `/health`.
- [x] Bundle-size gates remain below the Workers Free compressed limit.
- [x] Production Queue, dead-letter Queue and R2 journal resources exist in Cloudflare.
- [x] Web, Core, Jobs, six Workflows and both Durable Objects are deployed on the Free account.
- [x] The hourly Durable Object alarm is armed; deployed Web login and both health endpoints return `200`.
- [ ] Apply the migration to the supplied Neon database.
- [ ] Configure Cloudflare admin, Neon and Meta secrets.
- [ ] Run browser and dedicated Meta acceptance tests on the deployed stack.
- [ ] Configure final custom-domain routes and update Meta callback URLs.

The unchecked items require the Neon connection string, Meta application values, an
administrator password and the final hostname. They are deployment configuration and
live acceptance work, not missing implementation.
