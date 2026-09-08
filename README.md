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

Panel i strony publiczne są po polsku, wraz z walidacją, szablonami kampanii, etykietami dostępności oraz formatowaniem dat i liczb. Wygląd korzysta z marki DELTA240MVT: Inter, IBM Plex Mono, jasne tło, czerń i turkus z żółtymi oraz fioletowymi akcentami. Fonty z polskimi znakami są serwowane lokalnie; licencje znajdują się w `public/fonts/`.

Logo panelu, stron informacyjnych i raportów oraz favicon korzystają ze wspólnego pliku `app/icon.svg`, identycznego z faviconem portalu DELTA240MVT.

## Co robi InstaScaler

| Możliwość | Znaczenie w praktyce |
| --- | --- |
| Kampanie komentarz→DM | Słowo kluczowe, dowolny post, konkretny post albo następny post/Reel. |
| Początkowy DM i follow-gate | Wiadomość otwierająca, kontrola obserwowania i dostarczenie materiału po potwierdzeniu. |
| Linki i odpowiedzi | Dokładne URL-e, opcjonalne śledzenie, publiczne odpowiedzi oraz opóźnione follow-upy. |
| Wiele kont i analityka | Do pięciu kont, skrzynka, logi dostaw, kliknięcia oraz historia obserwujących jako wykres liniowy i tabela. |
| Odporność produkcyjna | R2, Queue, Durable Objects, Workflows, idempotencja i odzyskiwanie błędów. |

## Kształt środowiska uruchomieniowego

### Jak to działa — bez technicznego żargonu

Wyobraź sobie, że ktoś wpisuje `LINK` pod Twoim postem. Instagram informuje o tym InstaScaler. Aplikacja sprawdza, czy komentarz pasuje do aktywnej kampanii, pilnuje, aby tej samej osobie nie wysłać dwa razy tego samego materiału, i wysyła prywatną wiadomość. Jeżeli kampania wymaga obserwowania konta, odbiorca najpierw dostaje prośbę o obserwowanie i przycisk potwierdzenia. Dopiero potem otrzymuje właściwy link. Każdy etap zapisuje wynik, więc w panelu wiadomo, co zostało wysłane, pominięte, ponowione albo zakończone błędem.

Najważniejsze elementy mają osobne role:

- **Web** wyświetla panel i przekazuje żądania API do Core.
- **Core** przyjmuje webhooki Meta, sprawdza ich autentyczność i zapisuje zdarzenia.
- **R2** jest dziennikiem bezpieczeństwa — przechowuje pełne zdarzenie do czasu jego obsłużenia.
- **Queue** przekazuje małe zadanie do Jobs i odpowiada za ponowienia.
- **Jobs** wykonuje właściwą pracę: dopasowuje kampanię i komunikuje się z Instagramem.
- **Neon** pamięta konta, kampanie, wyniki i identyfikatory już obsłużonych zdarzeń.
- **Durable Objects** pilnują limitów wysyłki i uruchamiają harmonogram prac okresowych.

### Aktualny graf architektury

```text
 Użytkownik panelu
        │ HTTPS
        ▼
┌──────────────────────┐   service binding   ┌────────────────────────┐
│  instascaler-web     │ ──────────────────► │  instascaler-core       │
│  Next.js + OpenNext  │      /api/*          │  Hono API + webhook     │
└──────────────────────┘                      └───────┬─────────┬───────┘
                                                     │         │
 Instagram / Meta ── podpisany POST /webhook ───────┘         │ SQL
                                                     │         ▼
                                          weryfikacja podpisu  ┌────────────────┐
                                          i normalizacja       │ Neon Postgres  │
                                                     │         │ stan + dedupe  │
                                ┌────────────────────┴─────┐   └───────▲────────┘
                                │                          │           │ SQL
                                ▼                          ▼           │
                       ┌────────────────┐        ┌────────────────┐     │
                       │ R2 journal     │        │ Cloudflare     │     │
                       │ pełne zdarzenie│        │ Queue          │     │
                       └───────▲────────┘        │ klucz R2 + ID  │     │
                               │                 └───────┬────────┘     │
                               │ odczyt pełnych danych   │ trigger     │
                               └─────────────────────────┤             │
                                                         ▼             │
                                                ┌──────────────────────┴─┐
                                                │  instascaler-jobs      │
                                                │  dopasowanie kampanii  │
                                                │  dostawa + retry       │
                                                └───────────┬────────────┘
                                                            │
                                                ┌───────────▼────────────┐
                                                │ AccountRateLimiter DO  │
                                                │ limit wysyłek / konto  │
                                                └───────────┬────────────┘
                                                            │ Graph API
                                                            ▼
                                                       Instagram

 Osobna ścieżka okresowa:

 /internal/bootstrap → WorkflowScheduler DO → alarm co godzinę
                                      │
                                      ▼
          reconcile · recover R2 · refresh tokens · next Reel
               snapshots · retention → Cloudflare Workflows
```

### Ścieżka zdarzenia

1. **Zdarzenie powstaje w Instagramie.** Może to być komentarz, wiadomość tekstowa albo kliknięcie przycisku w DM (`postback`). Meta wysyła je jako `POST /webhook` do Core.
2. **Core sprawdza nadawcę.** Podpis `X-Hub-Signature-256` jest porównywany z HMAC wyliczonym przy użyciu `META_APP_SECRET`. Niepoprawnie podpisane żądanie kończy się kodem `401` i nie trafia dalej.
3. **Payload jest normalizowany.** Core odrzuca zdarzenia własnego konta i nieobsługiwane wiadomości, a pozostałym nadaje stabilny `externalId`, np. `comment:<id>` lub `message:<mid>`.
4. **Pełne zdarzenie trafia do R2.** Koperta JSON zawiera rodzaj zdarzenia, konto, czas i potrzebne dane. Klucz obiektu jest deterministyczny i powstaje z daty oraz skrótu `externalId`.
5. **Core sprawdza konto i dzienny budżet.** Dla znanego, połączonego konta zapisuje `ProcessedEvent.RECEIVED` i rezerwuje liczniki w jednej transakcji Neon. Powtórka nie zużywa ponownie budżetu przyjęć; reconciliation i recovery korzystają z tej samej ścieżki.
6. **Do Queue trafia tylko mała wiadomość.** Zawiera `externalId`, rodzaj zadania, identyfikator konta i `r2Key`. Pełny webhook ani token Meta nie podróżują w Queue.
7. **Meta dostaje potwierdzenie po zapisie R2.** Core odpowiada liczbą zapisanych zdarzeń. Przy błędzie dziennika zwraca `503`, aby Meta mogła ponowić webhook. Rezerwacja budżetu i publikowanie do kolejki kończą się w `waitUntil`, poza czasem odpowiedzi HTTP.
8. **Queue uruchamia Jobs.** Jobs sprawdza format wiadomości, wyszukuje konto w Neon i rezerwuje `ProcessedEvent`. Jeżeli `externalId` ma już stan końcowy, zdarzenie jest pomijane jako duplikat.
9. **Jobs pobiera pełną kopertę z R2.** Następnie wybiera obsługę `COMMENT`, `POSTBACK` albo `MESSAGE` i szuka aktywnej kampanii pasującej do posta oraz słów kluczowych.
10. **Przed każdą wysyłką działa limit konta.** `AccountRateLimiter` jako Durable Object serializuje rezerwacje dla danego konta. Brak dostępnego limitu powoduje retry zamiast utraty zdarzenia.
11. **Jobs wykonuje akcję przez oficjalny Graph API.** Zależnie od kampanii może wysłać początkowy DM, prośbę o obserwowanie, materiał z linkiem, publiczną odpowiedź albo opóźniony follow-up. Follow-up wraca do tej samej Queue jako zadanie z opóźnieniem.
12. **Neon zapisuje wynik.** Zdarzenie kończy jako `COMPLETED`, `SKIPPED`, `RETRYING` albo `FAILED`; osobny log dostawy przechowuje wynik widoczny w panelu.
13. **R2 jest sprzątane dopiero po bezpiecznym zakończeniu.** Dla wyniku wysłanego albo świadomie pominiętego Jobs usuwa kopertę z R2. Przy retry lub błędzie pozostaje ona do kolejnej próby albo odzyskania.
14. **Błędy przejściowe są ponawiane.** Queue stosuje backoff i maksymalnie pięć prób. Po ich wyczerpaniu wiadomość trafia do `instascaler-events-dlq`; godzinowy `RecoverJournalWorkflow` dodatkowo skanuje pozostawione koperty R2.

```text
NOWE → R2 → QUEUE → PROCESSING ─┬─► COMPLETED ─► usuń z R2
                               ├─► SKIPPED   ─► usuń z R2
                               ├─► RETRYING  ─► Queue retry / recovery R2
                               └─► FAILED    ─► zachowaj ślad do diagnostyki
```

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

Ręczne odpowiedzi ze skrzynki również wysyła Jobs, przez prywatny binding RPC `JOBS_API` z Core do entrypointu `ManualMessages`. Obowiązuje ten sam limiter konta co przy automatyzacjach. Edycja kampanii zachowuje istniejące slugi śledzonych linków i historię kliknięć.

Opóźnione wiadomości mają trwały zapis pod `follow-ups/` w R2. Odzyskiwanie przegląda ograniczone partie wpisów i zapisuje kursory w `control/`, dzięki czemu duży dziennik nie blokuje początku kolejnych skanów. Ukończona dostawa pozostaje ukończona także po błędzie sprzątania R2.

Tryb następnej publikacji wybiera post lub rolkę opublikowaną po ostatnim zapisie konfiguracji kampanii. Ponowne ustawienie tego trybu w starej kampanii nie przypina wcześniejszego materiału.

Przerwanie procesu pomiędzy zaakceptowaniem wysyłki przez Meta a zapisaniem wyniku w Neon pozostawia wynik niepewny. System nie ponawia ślepo takiej wysyłki: przed ręczną interwencją trzeba porównać wiadomości na Instagramie i stan diagnostyki.

### Testy przeglądarkowe

`npm run build`, a następnie `npm run test:e2e:local` uruchamiają testy polskiego panelu na desktopie i telefonie z kontrolowanymi odpowiedziami API. Testy te sprawdzają interakcje i błędy interfejsu, bez wysyłania wiadomości do prawdziwych użytkowników. `npm run test:e2e` pozostaje osobnym testem działającego środowiska, wymagającym zmiennych `E2E_*`. Wyniki i granice audytu zapisano w `docs/audits/2026-09-08-audit.md`.

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

## Praca z agentem AI

Repozytorium zawiera szczegółowe zasady implementacji dla Codexa i Claude Code w [`AGENTS.md`](AGENTS.md). Opisują one granice Workerów, bezpieczną ścieżkę webhook→R2→Queue→Jobs, wymagane testy, migracje Prisma, sekrety oraz sposób weryfikacji zmian. `CLAUDE.md` automatycznie importuje te same reguły, więc oba narzędzia korzystają z jednego źródła prawdy.

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

Podpisy Meta są weryfikowane, tokeny są szyfrowane w spoczynku, Queue nie przenosi pełnych tokenów, a sekrety należą wyłącznie do Cloudflare Secrets i lokalnego `.env`. Przed pushem skanuj tylko ostatni commit: `ggshield secret scan commit-range "HEAD^!"`. Hook pre-commit sprawdza wyłącznie zmiany przygotowane do commita. Pełną historię skanuj tylko na wyraźne żądanie użytkownika.

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
