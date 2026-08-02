# Stack

| Layer | Implementation | Free-tier control |
| --- | --- | --- |
| Web | Next.js 16 + OpenNext Worker | gzip checked below 3 MiB |
| API | Hono Core Worker | stateless, Neon per request |
| Database | Neon Serverless + Prisma adapter | no Hyperdrive or persistent pool |
| Events | Cloudflare Queue + R2 journal | 9,500 estimated operations/day |
| Rate limit | SQLite Durable Object per Instagram account | 200 sends/account/hour |
| Scheduled work | Cloudflare Workflows | max five accounts, bounded pages |
| Authentication | HMAC password verifier + signed host-only cookie | one administrator |
| Meta | Official Instagram Graph API | comments and messages webhooks |

The event path is: signed Meta webhook → normalized envelope in R2 → compact Queue message → idempotent Neon reservation → account Durable Object → Meta side effect → terminal database status → R2 deletion. Retry keeps the R2 object. Recovery and polling run every hour at minute 7.

Detailed delivery/event records are removed after 90 days; daily aggregates, accounts, campaigns, active failures and follower snapshots remain.
