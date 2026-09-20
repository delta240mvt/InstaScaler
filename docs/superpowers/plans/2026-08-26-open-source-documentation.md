# Open-source Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a Polish open-source README and a precise self-hosting runbook for InstaScaler.

**Architecture:** `README.md` keeps its existing information architecture while translating prose and replacing personal deployment values with portable placeholders. `INSTRUKCJA.md` is the operational source of truth for a fresh deploy: Codex terminal and Wrangler authentication, local clone, Cloudflare, Neon, Meta, verification, and troubleshooting.

**Tech Stack:** Markdown, Node.js 20+, npm, Wrangler, Cloudflare Workers/R2/Queues/Durable Objects/Workflows, Neon Postgres, Prisma, Meta Graph API.

## Global Constraints

- Keep the name `InstaScaler` unchanged.
- Do not include personal deployment domains, account identifiers, webhook tokens, or credentials.
- Do not add GitHub Actions or application dependencies.
- Preserve README section order, executable commands, variable names, file paths, and external technical product names.
- Credit OpenReply as inspiration; do not claim an accepted contribution or affiliation.

---

### Task 1: Translate and sanitize README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: `.env.example`, `package.json`, `wrangler.web.jsonc`, `wrangler.core.jsonc`, and `wrangler.jobs.jsonc` as the authoritative command and configuration sources.
- Produces: Polish project overview with a GitGuardian badge and accurate OpenReply attribution.

- [ ] **Step 1: Preserve the README outline and translate all reader-facing copy**

Replace English prose and headings with Polish while leaving code fences, command names, variable names, architecture identifiers, paths, and `InstaScaler` intact. Preserve these top-level sections in the existing order:

```text
What InstaScaler does
Runtime shape
Free-plan operating envelope
Retry and resilience
Quick start
Production deployment
Cloudflare routes
Environment contract
Meta webhook setup
Project map
Useful commands
Production acceptance checklist
Security posture
Roadmap
FAQ
License
Cloudflare Free setup
```

- [ ] **Step 2: Add the GitGuardian badge and the attribution section**

Place this badge alongside the existing technology badges:

```markdown
[![GitGuardian](https://img.shields.io/badge/security-GitGuardian-00C853?style=flat-square&logo=gitguardian)](https://www.gitguardian.com/)
```

Add a section before `## License` with this factual copy:

```markdown
## Pochodzenie projektu

InstaScaler rozwija kierunek automatyzacji Instagram „komentarz → prywatna wiadomość”, popularyzowany przez [OpenReply](https://github.com/diwenne/openreply). Jest niezależną implementacją zaprojektowaną od nowa pod infrastrukturę serverless: Cloudflare Workers, Queues, R2, Durable Objects, Workflows i Neon Postgres.
```

- [ ] **Step 3: Replace personal worker domains with neutral values**

Use these portable examples in text and code blocks:

```text
https://YOUR-INSTASCALER-DOMAIN.example
https://YOUR-INSTASCALER-DOMAIN.example/api/instagram/callback
https://YOUR-INSTASCALER-CORE.example/webhook
```

Remove references to a GitHub deployment workflow because the repository no longer includes GitHub Actions.

- [ ] **Step 4: Verify documentation safety and structure**

Run:

```powershell
rg -n -i 'delta240mvt\.workers\.dev|instascaler-web\.delta240mvt|instascaler-core\.delta240mvt' README.md
rg -n '^#{1,3} ' README.md
```

Expected: the first command returns no matches; the second displays the preserved section structure in Polish.

### Task 2: Create the deployment runbook

**Files:**
- Create: `INSTRUKCJA.md`

**Interfaces:**
- Consumes: `.env.example`, `scripts/generate-admin-secrets.mjs`, `package.json`, all three `wrangler.*.jsonc` files, and the README environment contract.
- Produces: reproducible instructions for a fresh self-hosted production installation.

- [ ] **Step 1: Document prerequisites and the Codex terminal / Wrangler login**

Include these commands with explanations of the browser login and account verification:

```powershell
npm install -g wrangler
wrangler login
wrangler whoami
```

- [ ] **Step 2: Document cloning, local configuration, and Neon migration**

Include this sequence and explain that placeholders must be replaced only in the untracked `.env` file:

```powershell
git clone https://github.com/YOUR_GITHUB_USERNAME/InstaScaler.git
cd InstaScaler
npm ci
Copy-Item .env.example .env
node scripts/generate-admin-secrets.mjs 'WYBIERZ_DLUGIE_UNIKALNE_HASLO'
npm run db:generate
npm run db:migrate
```

- [ ] **Step 3: Document Cloudflare resource creation, secrets, and deployment**

Include explicit commands for the bucket and queues:

```powershell
wrangler r2 bucket create instascaler-event-journal
wrangler queues create instascaler-events
wrangler queues create instascaler-events-dlq
```

Document `wrangler secret put` separately for Core and Jobs, using the exact config filenames and the variables from `.env.example`. Include the deploy order `jobs`, `core`, then `web`, plus the authenticated `/internal/bootstrap` request.

- [ ] **Step 4: Document Meta and Instagram setup**

Describe creating a Meta developer app, adding the appropriate Instagram Login and webhook products, copying the App ID/secret to Cloudflare Secrets, registering the exact HTTPS OAuth redirect and webhook callback, using `META_WEBHOOK_VERIFY_TOKEN`, subscribing to `comments` and `messages`, adding a tester in development mode, connecting a Business or Creator Instagram account from Settings, and requesting production permissions/review when required.

- [ ] **Step 5: Add acceptance, security, and troubleshooting sections**

Include the following safe validation commands and explain expected outcomes:

```powershell
npm test
npm run typecheck
npm run lint
ggshield secret scan repo .
git status --short
```

Cover the specific failure classes: incorrect redirect URL, webhook verification failure, missing `comments` or `messages` subscription, non-professional Instagram account, absent Jobs secret, missing bootstrap call, and no local ggshield hook after cloning.

- [ ] **Step 6: Verify links, personal-domain exclusion, and command references**

Run:

```powershell
rg -n -i 'delta240mvt\.workers\.dev|instascaler-web\.delta240mvt|instascaler-core\.delta240mvt' README.md INSTRUKCJA.md
rg -n 'cf:deploy:jobs|cf:deploy:core|cf:deploy:web|SCHEDULER_BOOTSTRAP_TOKEN|META_WEBHOOK_VERIFY_TOKEN' INSTRUKCJA.md
```

Expected: the first command returns no matches; the second finds each named deployment and secret reference.

### Task 3: Review the public documentation set

**Files:**
- Modify: `README.md` and `INSTRUKCJA.md` only if review finds an inconsistency.

**Interfaces:**
- Consumes: finished documentation from Tasks 1 and 2.
- Produces: a release-ready, secret-free documentation set.

- [ ] **Step 1: Check all tracked documentation changes**

Run:

```powershell
git diff --check -- README.md INSTRUKCJA.md
git diff --word-diff=plain -- README.md INSTRUKCJA.md
```

Expected: no whitespace errors; prose remains Polish while command syntax is unchanged.

- [ ] **Step 2: Run the unit test suite**

Run:

```powershell
npm test
```

Expected: Vitest exits with code `0`.

- [ ] **Step 3: Commit the documentation**

Run:

```powershell
git add README.md INSTRUKCJA.md
git commit -m "docs: add Polish open-source setup guide"
```

Expected: only the translated README and new runbook are included in this commit.
