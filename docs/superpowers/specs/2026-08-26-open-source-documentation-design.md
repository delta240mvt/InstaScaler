# Open-source documentation design

## Goal

Prepare InstaScaler for an open-source release with a Polish README and a reproducible deployment guide, without exposing personal deployment domains or credentials.

## README

Keep the existing README section order and technical coverage. Translate the prose, tables, checklists, and headings into Polish while preserving the product name `InstaScaler`, commands, variable names, file paths, and external technical names. Replace every personal workers.dev deployment URL with neutral placeholders such as `https://YOUR-INSTASCALER-DOMAIN.example`.

Add a GitGuardian status badge that links to GitGuardian. Add a "Pochodzenie projektu" section that credits OpenReply as inspiration and describes InstaScaler as an independently implemented serverless Cloudflare and Neon adaptation of the comment-to-DM direction. The wording must not claim an accepted contribution to OpenReply.

## INSTRUKCJA.md

Create a Polish, step-by-step deployment runbook for a new maintainer. It covers:

1. Required accounts and local prerequisites.
2. Using the Codex local terminal to authenticate Wrangler with Cloudflare.
3. Cloning the repository into a local folder and installing dependencies.
4. Creating a Neon database and configuring local environment values.
5. Generating administrator secrets and applying Prisma migrations.
6. Provisioning Cloudflare queues, Durable Objects, Workers secrets, and the three deployments.
7. Creating and configuring a Meta developer app, Instagram Login redirect, webhook callback, event subscriptions, and tester access.
8. Connecting a professional Instagram account and carrying out an end-to-end test.
9. Operational checks, common failures, GitGuardian scan, and publication checklist.

## Safety and verification

No credential, personal domain, account ID, or real webhook token may appear in either document. All commands must match package scripts and Wrangler configuration in this repository. Validate Markdown links, search for personal worker domains, and run the repository documentation checks that are available locally.
