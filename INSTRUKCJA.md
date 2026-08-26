# Instrukcja uruchomienia InstaScaler

Ten przewodnik prowadzi od terminala Codexa do działającej instancji Cloudflare i Meta. Nie wklejaj sekretów do Git ani do rozmowy z asystentem.

## 1. Konta i wymagania

Potrzebujesz kont: Cloudflare, Neon, Meta for Developers oraz GitHub. Konto Instagram musi być typu Business albo Creator. Zainstaluj Node.js 20+, Git i otwórz lokalny terminal w Codexie.

## 2. Cloudflare w terminalu Codexa

W terminalu projektu użyj lokalnego Wranglera z zależności repozytorium:

```powershell
npm ci
npx wrangler login
npx wrangler whoami
```

`login` otworzy przeglądarkę Cloudflare; po akceptacji `whoami` musi pokazać właściwe konto. Nie potrzebujesz osobnego klucza R2 do poleceń Wranglera.

## 3. Klon i konfiguracja lokalna

```powershell
git clone https://github.com/YOUR_GITHUB_USERNAME/InstaScaler.git
cd InstaScaler
npm ci
Copy-Item .env.example .env
node scripts/generate-admin-secrets.mjs 'WYBIERZ_DLUGIE_UNIKALNE_HASLO'
```

Utwórz projekt Neon, skopiuj poolowany `DATABASE_URL` z TLS do `.env` i uzupełnij wszystkie placeholdery w `.env.example`. Ustaw `APP_BASE_URL` na przyszły publiczny adres, a `META_REDIRECT_URI` na `https://YOUR-INSTASCALER-DOMAIN.example/api/instagram/callback`.

```powershell
npm run db:generate
npm run db:migrate
npm run dev
```

## 4. Zasoby Cloudflare

```powershell
npx wrangler r2 bucket create instascaler-event-journal
npx wrangler queues create instascaler-events
npx wrangler queues create instascaler-events-dlq
```

Pliki `wrangler.web.jsonc`, `wrangler.core.jsonc` i `wrangler.jobs.jsonc` definiują Workery, bindingi R2/Queue, Durable Objects i Workflows. Nie zmieniaj ich nazw, jeśli tworzysz zasoby z poleceń powyżej.

## 5. Sekrety

Wartości wpisuj interaktywnie — nie podawaj ich w linii polecenia. Core wymaga: `DATABASE_URL`, `APP_BASE_URL`, `ADMIN_LOGIN`, `ADMIN_PASSWORD_PEPPER`, `ADMIN_PASSWORD_VERIFIER`, `SESSION_SIGNING_KEY`, `ENCRYPTION_KEY`, `OAUTH_STATE_KEY`, `IP_HASH_SALT`, `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_WEBHOOK_VERIFY_TOKEN`. Jobs wymaga: `DATABASE_URL`, `APP_BASE_URL`, `ENCRYPTION_KEY`, `SCHEDULER_BOOTSTRAP_TOKEN`.

```powershell
npx wrangler secret put DATABASE_URL --config wrangler.core.jsonc
npx wrangler secret put DATABASE_URL --config wrangler.jobs.jsonc
npx wrangler secret put ENCRYPTION_KEY --config wrangler.core.jsonc
npx wrangler secret put ENCRYPTION_KEY --config wrangler.jobs.jsonc
npx wrangler secret put SCHEDULER_BOOTSTRAP_TOKEN --config wrangler.jobs.jsonc
```

Powtórz `wrangler secret put NAZWA --config wrangler.core.jsonc` dla pozostałych sekretów Core.

## 6. Deploy i bootstrap

```powershell
npm run db:generate
npm run db:migrate
npm run cf:build:web
npm run cf:deploy:jobs
npm run cf:deploy:core
npm run cf:deploy:web
```

Na własnej domenie ustaw w Cloudflare: `/api/*`, `/webhook*`, `/r/*` i `/health` do `instascaler-core`; `/*` do `instascaler-web`. Następnie jednorazowo uruchom harmonogram:

```powershell
curl.exe -X POST https://YOUR-INSTASCALER-JOBS.example/internal/bootstrap -H "Authorization: Bearer YOUR_SCHEDULER_BOOTSTRAP_TOKEN"
```

## 7. Meta i Instagram

1. W Meta for Developers utwórz aplikację i dodaj Instagram Login oraz Webhooks.
2. Wpisz App ID i App Secret jako `META_APP_ID` oraz `META_APP_SECRET` w sekretach Core.
3. Dodaj dokładny OAuth redirect: `https://YOUR-INSTASCALER-DOMAIN.example/api/instagram/callback`.
4. Ustaw callback webhooka: `https://YOUR-INSTASCALER-CORE.example/webhook`; jako verify token użyj wartości `META_WEBHOOK_VERIFY_TOKEN`.
5. Zasubskrybuj `comments` i `messages`. W trybie Development dodaj swoje konto Facebook/Instagram jako testera. Produkcja wymaga spełnienia bieżących wymagań i review Meta.
6. Zaloguj się do dashboardu, otwórz Settings i wybierz **Connect Instagram**.

## 8. Test końcowy i diagnostyka

```powershell
npm test
npm run typecheck
npm run lint
ggshield secret scan repo .
git status --short
```

Z innego konta dodaj komentarz pasujący do aktywnej kampanii. Sprawdź DM, link, follow-gate i logi. Gdy OAuth zwraca błąd, porównaj znak po znaku redirect URL z Meta. Gdy webhook nie przechodzi weryfikacji, sprawdź callback i `META_WEBHOOK_VERIFY_TOKEN`. Brak `comments` lub `messages` zatrzymuje odpowiedni trigger. Brak DMa po zaakceptowanym webhooku zwykle oznacza brak sekretu Jobs albo pominięty bootstrap. Po świeżym klonie zainstaluj lokalny hook GitGuardian: `ggshield install --mode local`.

## 9. Publikacja open source

Przed publicznym push: usuń lokalne domeny i dane kont, sprawdź `git status`, uruchom pełny skan GitGuardian i nie commituj `.env`. Lokalny hook można pominąć przez `--no-verify`, dlatego skan historii jest obowiązkową kontrolą wydania.
