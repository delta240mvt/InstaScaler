# InstaScaler by delta240mvt

<div align="center">

<pre>
 ██╗███╗   ██╗███████╗████████╗ █████╗
 ██║████╗  ██║██╔════╝╚══██╔══╝██╔══██╗
 ██║██╔██╗ ██║███████╗   ██║   ███████║
 ██║██║╚██╗██║╚════██║   ██║   ██╔══██║
 ██║██║ ╚████║███████║   ██║   ██║  ██║
 ╚═╝╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝

 ███████╗ ██████╗ █████╗ ██╗     ███████╗██████╗
 ██╔════╝██╔════╝██╔══██╗██║     ██╔════╝██╔══██╗
 ███████╗██║     ███████║██║     █████╗  ██████╔╝
 ╚════██║██║     ██╔══██║██║     ██╔══╝  ██╔══██╗
 ███████║╚██████╗██║  ██║███████╗███████╗██║  ██║
 ╚══════╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝
                         I N S T A G R A M   A U T O M A T I O N
</pre>

**Prywatna, natywna dla Cloudflare konsola automatyzacji Instagrama, która zamienia komentarze w rozmowy.**

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com/) [![Next.js 16](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/) [![Neon](https://img.shields.io/badge/Database-Neon%20Serverless-00e599?style=flat-square)](https://neon.tech/) [![Meta Graph API](https://img.shields.io/badge/Instagram-Meta%20Graph%20API-E1306C?style=flat-square&logo=instagram)](https://developers.facebook.com/docs/instagram-api/) [![GitGuardian](https://img.shields.io/badge/security-GitGuardian-00C853?style=flat-square&logo=gitguardian)](https://www.gitguardian.com/) [![License](https://img.shields.io/badge/License-MIT-4a8d83.svg?style=flat-square)](LICENSE)

**Jeden administrator · Do pięciu profesjonalnych kont Instagram · Projekt świadomy limitów Free**

</div>

---

InstaScaler obsługuje najważniejszy przepływ automatyzacji: komentarz zaczyna prywatną rozmowę, właściwa osoba dostaje właściwy link, a każda dostawa pozostaje obserwowalna. Bez stale działającego serwera, Redis ani Hyperdrive — tylko oficjalne API Meta, Cloudflare Workers i serverlessowy Neon.

## Co robi InstaScaler

| Możliwość | Znaczenie w praktyce |
| --- | --- |
| Kampanie komentarz→DM | Słowo kluczowe, dowolny post, konkretny post albo następny post/Reel. |
| Początkowy DM i follow-gate | Wiadomość otwierająca, kontrola obserwowania i dostarczenie materiału po potwierdzeniu. |
| Linki i odpowiedzi | Dokładne URL-e, opcjonalne śledzenie, publiczne odpowiedzi oraz opóźnione follow-upy. |
| Wiele kont i analityka | Do pięciu kont, skrzynka, logi dostaw, kliknięcia i migawki obserwujących. |
| Odporność produkcyjna | R2, Queue, Durable Objects, Workflows, idempotencja i odzyskiwanie błędów. |

## Kształt środowiska uruchomieniowego

```text
                         ┌──────────────────────┐
                         │  instascaler-web     │
                         │  Next.js + OpenNext  │
                         └──────────┬───────────┘
                                    │ service binding / routes
                         ┌──────────▼───────────┐
                         │  instascaler-core    │
                         │  Hono API + Meta     │
                         └──────┬────────┬──────┘
                                │        │
                         signed │        │ serverless SQL
                         events  │        ▼
                                ▼   ┌───────────────┐
                         ┌────────┐│ Neon Postgres │
                         │ R2     │└───────────────┘
                         │journal │
                         └───┬────┘
                             │ compact Queue message
                             ▼
                    ┌─────────────────────────┐
                    │  instascaler-jobs       │
                    │  Queue + Workflows      │
                    │  Durable Object limits  │
                    └────────────┬────────────┘
                                 │ official Graph API side effects
                                 ▼
                            Instagram
```

### Ścieżka zdarzenia

1. Meta wysyła podpisany webhook do Core.
2. Core weryfikuje go, zapisuje kopertę w R2 i publikuje wiadomość Queue.
3. Jobs rezerwuje idempotentną dostawę w Neon; Durable Object chroni konto przed skokami wysyłek.
4. Jobs wysyła DM, komentarz lub follow-up przez Graph API, a Neon zapisuje stan końcowy.

## Limity działania na planie Free

| Zabezpieczenie | Budżet aplikacji |
| --- | ---: |
| Zdarzenia przychodzące | 1 000 dziennie UTC |
| Operacje Queue | 9 500 dziennie UTC |
| Kroki Workflow | 2 800 dziennie UTC |
| Wysyłki Meta na konto | 200 na godzinę |
| Połączone konta | 5 |

## Ponawianie i odporność

Queue używa ograniczonego backoffu: 60, 120, 240, 480 i 960 sekund, maksymalnie pięć prób. Gdy dostawa nadal nie może się zakończyć, `RecoverJournalWorkflow` odzyskuje kopertę pozostawioną w R2.

## Szybki start

### Wymagania

- Node.js 20+
- Neon Postgres z `DATABASE_URL` przez TLS
- Cloudflare Workers, R2 i Queues
- Aplikacja Meta z Instagram Login, webhookiem i uprawnieniami wiadomości

### Konfiguracja lokalna

```bash
git clone https://github.com/delta240mvt/InstaScaler.git
cd InstaScaler
npm ci
copy .env.example .env
node scripts/generate-admin-secrets.mjs "twoje-długie-unikalne-hasło"
npm run db:generate
npm run db:migrate
npm run dev
```

Nigdy nie commituj `.env` ani prawdziwych sekretów.

## Wdrożenie produkcyjne

Utwórz `instascaler-event-journal`, `instascaler-events` i `instascaler-events-dlq`, ustaw Cloudflare Secrets, a następnie uruchom:

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run cf:build:web
npm run cf:deploy:jobs
npm run cf:deploy:core
npm run cf:deploy:web
```

Po wdrożeniu uzbrój harmonogram:

```bash
curl -X POST https://YOUR-INSTASCALER-JOBS.example/internal/bootstrap \
  -H "Authorization: Bearer $SCHEDULER_BOOTSTRAP_TOKEN"
```

Pełny przewodnik Cloudflare, Wrangler i Meta: [INSTRUKCJA.md](INSTRUKCJA.md).

## Trasy Cloudflare

```text
/api/*, /webhook*, /r/* i /health → instascaler-core
/*                              → instascaler-web
```

## Kontrakt zmiennych środowiskowych

Pełna lista jest w [`.env.example`](.env.example). Core używa między innymi `DATABASE_URL`, `APP_BASE_URL`, `ADMIN_LOGIN`, `ADMIN_PASSWORD_PEPPER`, `ADMIN_PASSWORD_VERIFIER`, `SESSION_SIGNING_KEY`, `ENCRYPTION_KEY`, `OAUTH_STATE_KEY`, `IP_HASH_SALT`, `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` i `META_WEBHOOK_VERIFY_TOKEN`. Jobs wymaga `DATABASE_URL`, `APP_BASE_URL`, `ENCRYPTION_KEY` i `SCHEDULER_BOOTSTRAP_TOKEN`.

## Konfiguracja webhooka Meta

Ustaw callback `https://YOUR-INSTASCALER-CORE.example/webhook`, token `META_WEBHOOK_VERIFY_TOKEN` i OAuth redirect `https://YOUR-INSTASCALER-DOMAIN.example/api/instagram/callback`. W trybie rozwoju dodaj konto jako testera; w produkcji obowiązują wymagania review Meta.

## Mapa projektu

```text
app/ i components/       Next.js UI
lib/                     Meta, dostarczanie, zadania i Neon/Prisma
workers/core/            API i webhook
workers/jobs/            Queue, Workflows i Durable Objects
prisma/                  schemat i migracje
docs/                    runbooki
```

## Przydatne polecenia

| Zadanie | Polecenie |
| --- | --- |
| Testy | `npm test` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Build Web | `npm run cf:build:web` |
| Deploy Jobs/Core/Web | `npm run cf:deploy:jobs`, `npm run cf:deploy:core`, `npm run cf:deploy:web` |

## Lista akceptacyjna produkcji

- [ ] Zaloguj administratora i połącz profesjonalne konto Instagram.
- [ ] Wyślij testowy komentarz z innego konta i sprawdź DM, follow-gate, link oraz follow-up.
- [ ] Sprawdź `/health`, logi, powielony webhook i odzyskiwanie błędów.

## Postawa bezpieczeństwa

Podpisy Meta są weryfikowane, tokeny są szyfrowane w spoczynku, Queue nie przenosi pełnych tokenów, a sekrety należą wyłącznie do Cloudflare Secrets i lokalnego `.env`. Przed publikacją uruchom `ggshield secret scan repo .`.

## Roadmap

- [x] Workery Web, Core i Jobs; Neon, R2, Queue, Durable Objects i Workflows
- [x] Follow-gate, początkowy DM, follow-up, linki śledzone i odzyskiwanie
- [ ] Rozgałęzienia kampanii, bogatsza analityka i własna domena

## FAQ

**Czy wymagany jest Redis?** Nie. Wymagania zdarzeń, stanu i ponowień pokrywają Cloudflare oraz Neon.

**Czy to SaaS?** Nie. InstaScaler jest projektem self-hosted: wdrażasz własną instancję i własną aplikację Meta.

## Pochodzenie projektu

InstaScaler rozwija kierunek automatyzacji Instagram „komentarz → prywatna wiadomość”, popularyzowany przez [OpenReply](https://github.com/diwenne/openreply). Jest niezależną implementacją zaprojektowaną od nowa pod infrastrukturę serverless: Cloudflare Workers, Queues, R2, Durable Objects, Workflows i Neon Postgres.

## Licencja

MIT — szczegóły w [`LICENSE`](LICENSE).

---

<div align="center"><strong>InstaScaler by delta240mvt</strong><br><em>Komentarze wchodzą. Rozmowy wychodzą.</em></div>
