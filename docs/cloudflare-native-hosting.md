# Cloudflare-native hosting assessment

## Verdict

**Yes, this application can be hosted on Cloudflare, but it is not a zero-change
lift-and-shift.** The Next.js site and API can run on Workers through OpenNext.
To be genuinely Cloudflare-native, the always-on BullMQ/Redis worker must be
replaced by Workers Queues plus Workflows (for delayed, durable work), and the
current PostgreSQL database should initially remain PostgreSQL behind Hyperdrive.

This is a good fit for the application's webhook-driven DM processing, retries,
scheduled maintenance, and follow-up messages. It is *not* a good candidate for
running the existing `npm run worker` process unchanged: Workers are
request/event-driven, not a persistent Node process host.

## What can move directly

| Current component | Cloudflare-native target | Assessment |
| --- | --- | --- |
| Next.js 16 App Router, pages, API routes, webhook and OAuth endpoints | Worker via `@opennextjs/cloudflare` | Supported, subject to runtime validation. |
| Vercel cron endpoints | `scheduled()` Cron Triggers or Workflow schedules | Direct functional replacement. |
| BullMQ producer/consumer and retry queue | Workers Queues | Rewrite required; preserves asynchronous, at-least-once delivery model. |
| BullMQ delayed follow-ups and multi-step Meta calls | Workflows | Better semantic fit for durable waits and per-step retries. |
| PostgreSQL + Prisma | Existing Postgres through Hyperdrive | Recommended first migration path. |
| Redis rate limiting / worker health | Durable Objects or a Cloudflare storage redesign | Rewrite required; do not assume `ioredis` is portable. |

Cloudflare documents support for the OpenNext adapter across the App Router,
Route Handlers, React Server Components, SSR, ISR, Server Actions, streaming,
middleware, and `next/after`. Node.js in Next middleware is the stated
exception. An existing project can be detected by `wrangler deploy`; a manual
setup uses `@opennextjs/cloudflare`, `.open-next/worker.js`,
`.open-next/assets`, and `nodejs_compat` with compatibility date at least
2024-09-23. [Cloudflare: Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)

## Repository-specific blockers and replacements

1. **The current background process is not deployable as-is.**
   `worker/dm-worker.ts` starts a persistent BullMQ worker, heartbeat and
   `setInterval` polling loop. Replace it with a Queue consumer for immediate
   webhook work, scheduled invocations for reconciliation, and Workflows for
   the follow-up delay / dependent delivery flow. Queues delivers at least once,
   so preserve the existing database uniqueness and idempotency protections.
   [Queues delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/)

2. **BullMQ and `ioredis` should be removed from the Worker path.**
   The code currently expects a long-lived native Redis/TCP connection and
   BullMQ's worker semantics. Workers offers a subset of Node APIs under
   `nodejs_compat`; polyfilled APIs can import but throw or no-op when called.
   Cloudflare explicitly recommends testing the Worker-runtime preview, so this
   should not be treated as compatible merely because it bundles.
   [Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)

3. **Use Workflows for durable DM pipelines and waits.**
   A Workflow can persist successful steps, retry a failed Meta API call with
   configured backoff, and sleep for a relative duration or until a timestamp.
   That cleanly covers the existing delayed follow-up messages, including delays
   longer than Queues' 24-hour maximum. Make every Meta side effect idempotent:
   delivery can resume/retry after an interruption.
   [Workflow sleeps and retries](https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/)
   [Queues delays limit](https://developers.cloudflare.com/queues/platform/limits/)

4. **Replace the three Vercel crons and the comment polling timer.**
   Cloudflare Cron Triggers invoke a Worker's `scheduled()` handler using a
   five-field UTC cron expression. Workflow schedules are also available when
   the job is itself a Workflow. Use Cron for the daily token refresh, reel
   attachment, follower snapshot and periodic reconciliation; do not keep an
   in-memory timer.
   [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
   [Trigger Workflows](https://developers.cloudflare.com/workflows/build/trigger-workflows/)

## Database decision: Hyperdrive now, D1 only as a later rewrite

Keep the existing PostgreSQL schema and Prisma usage behind **Hyperdrive** for
the first deployment. Hyperdrive accelerates and pools connections from Workers
to existing Postgres/MySQL (including Neon) and is designed to work with existing
drivers and ORMs. This avoids converting the Prisma/Postgres schema, migrations,
Postgres-specific types/behaviour, and authentication tables all at once.
[Hyperdrive overview](https://developers.cloudflare.com/hyperdrive/)

Use **D1** only if the team deliberately accepts a SQLite-based, Cloudflare
managed database and migration/testing work. Cloudflare positions D1 for
lightweight serverless applications, especially read-heavy global workloads;
it is not a transparent PostgreSQL endpoint. Hyperdrive does not connect to D1.
[Cloudflare storage selection](https://developers.cloudflare.com/workers/platform/storage-options/)
[Hyperdrive FAQ](https://developers.cloudflare.com/hyperdrive/reference/faq/)

If Hyperdrive query caching is enabled, bind a cache-disabled Hyperdrive
configuration for session/auth/permission and read-after-write paths: writes do
not invalidate its query cache. [Hyperdrive query caching](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/)

## Recommended migration sequence

1. Add OpenNext and Wrangler configuration; deploy a preview Worker with
   `nodejs_compat`, then exercise OAuth, Auth.js, webhook verification and all
   database-backed routes in the Worker runtime.
2. Bind Hyperdrive to the current Postgres provider, retaining Prisma and its
   current migrations. Remove Vercel-only analytics before production cutover.
3. Replace BullMQ enqueue calls with Queues producers; implement a Queue
   consumer with explicit idempotency, retry policy, and a dead-letter queue.
4. Move delayed follow-ups and retry-sensitive DM delivery to Workflows.
5. Move all interval work to Cron Triggers / Workflow schedules and replace
   Redis health/rate-limit state with a Cloudflare-native design.
6. Run webhooks in parallel briefly, cut Meta webhook URLs to the Worker, then
   decommission Redis and the external always-on worker only after queue and
   delivery observability match the present behaviour.

## Bottom line

Cloudflare Workers + OpenNext + Hyperdrive + Queues + Workflows is a viable
production architecture for this repository. It is **mostly a background-job
and state-management migration**, not a Next.js migration. D1 is optional and
should not be bundled into the first cutover.
