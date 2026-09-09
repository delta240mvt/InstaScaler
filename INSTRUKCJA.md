# Instrukcja uruchomienia InstaScaler

Ten przewodnik prowadzi od terminala Codexa do działającej instancji Cloudflare i Meta. Nie wklejaj sekretów do Git ani do rozmowy z asystentem.

## Oddzielny lokalny landing

Opcjonalny katalog `landing/` służy do samodzielnej strony Astro dla marki GENIUS@WORK. Jest ignorowany przez nadrzędny Git; utrzymuj jego kopię niezależnie od repozytorium InstaScalera. Landing ma własne `package.json`, konfigurację Cloudflare Pages i instrukcję w lokalnym `landing/README.md`.

Weryfikację landingu uruchamiaj z jego katalogu: `npm run check`, `npm run build`, a następnie `node scripts/verify-build.mjs`. Wdrożenie dotyczy wyłącznie świeżego `landing/dist/`, nie Workerów aplikacji. Dane `CLOUDFLARE_*` i `LANDING_*` trzymaj w nadrzędnym, ignorowanym `.env`; nie kopiuj sekretów aplikacji do landingu ani jego publicznych plików. Istniejąca kolejność wdrażania Jobs → Core → Web pozostaje niezależna od strony informacyjnej.

### Nagranie filmu z lokalnego panelu

Wymagane są gotowy build aplikacji (`npm run build`), zależności lokalnego landingu (w tym `tsx`), przeglądarka Microsoft Edge oraz `ffmpeg` i `ffprobe` w PATH. W osobnym terminalu uruchom `npx next start --hostname 127.0.0.1 --port 3137`. Z katalogu głównego:

```bash
node --import ./landing/node_modules/tsx/dist/loader.mjs scripts/record-product-demo.ts
node scripts/render-product-demo.mjs
```

Opcja `--probe` zapisuje tylko cztery kadry do sprawdzenia. Nagrywanie korzysta z prawdziwego lokalnego interfejsu i istniejących danych testowych; wszystkie API są zastępowane fixture'ami, a ruch poza `127.0.0.1:3137` jest blokowany. Nie zmieniaj tego adresu na produkcję. Surowe nagrania pozostają w `landing/.recording/`, gotowe pliki w `landing/public/media/`. Po renderze sprawdź materiał, a następnie wykonaj check i build landingu przed wdrożeniem. Film nie wymaga wdrażania Workerów aplikacji.

## Ścieżki START — konfiguracja i obsługa

1. Po aktualizacji kodu wykonaj kopię bazy i sprawdź `npx prisma migrate status`. Zastosuj addytywną migrację quizów poleceniem `npm run db:migrate`; nie używaj resetu ani `db push` na produkcji. Wygeneruj klienta przez `npm run db:generate`.
   Wejście przez DM wymaga migracji `20260909120000_quiz_dm_trigger`, która dodaje źródłowy identyfikator wiadomości i dopuszcza brak źródłowego komentarza. Dotychczasowe ścieżki nadal działają po komentarzu. Po migracji wdrażaj Jobs, Core, a następnie zbudowany Web.
2. Otwórz **Ścieżki**, wybierz konto i sposób uruchomienia: komentarz pod postem albo słowo w DM. Utwórz szkic. Przykład jest fikcyjny. Dostosuj hasło START i zaproszenie z przyciskiem; zakres postów dotyczy tylko komentarzy. Szkic sam niczego nie wysyła.
3. Wybierz karty na planszy. Edytuj treści, odpowiedzi, pola i tagi oraz „Połącz z krokiem”. Warunek ma osobne cele dla wyniku pozytywnego i negatywnego. Cały graf ma najwyżej 10 kroków, łącznie ze Startem i Końcem.
4. W zakładce **Kwalifikacja** ustaw dowolny lub wszystkie warunki. Domyślnie wystarczy poprawny e-mail lub zainteresowanie pomocą. Podgląd używa tego samego silnika, ale nie korzysta z Meta i nie tworzy kontaktów.
5. Zapisz szkic, usuń wskazane błędy i wybierz **Opublikuj i włącz**. Kolidująca aktywna kampania lub ścieżka z tym samym hasłem i zakresem postów zablokuje publikację. Publikacja nie zmienia wersji już rozpoczętych rozmów.
6. W **Bazie kontaktów** filtruj wartościowe leady, e-mail, zainteresowanie, tagi, konto, ścieżkę i stan. Profil pokazuje odpowiedzi oraz powody kwalifikacji. Równoczesna edycja w innej karcie lub nowa odpowiedź może wywołać konflikt zapisu — lokalne zmiany pozostają widoczne.
7. STOP zatrzymuje rozmowę. **Wyłącz nowe wejścia** pozostawia istniejące quizy; **Wstrzymaj całą ścieżkę** blokuje również ich wysyłkę. Ręczna odpowiedź w skrzynce wstrzymuje quiz odbiorcy. Wznowienie poza oknem Meta czeka na nową interakcję. Stan „Wysyłka do sprawdzenia” wymaga sprawdzenia skrzynki; nie ponawiaj niepewnego DM w ciemno.
8. Usunięcie kontaktu usuwa odpowiedzi i zatrzymuje oczekujące kroki. Nie cofa wiadomości już dostarczonych. Techniczny odcisk blokuje odtworzenie starego kontaktu przez retry.

Nowy moduł nie wymaga kolejnego bindingu ani usługi. Wdrażaj **Jobs → Core → Web**; build Web musi powstać przed wdrożeniem. Po aktualizacji sprawdź `/health`, logowanie, `/paths`, podgląd i bazę kontaktów. W razie regresji wyłącz wejścia i wstrzymaj ścieżki; można przywrócić poprzedni kod bez usuwania nowych tabel.

Optymalizacja odczytów wymaga ponownego `npm run db:generate` i wdrożenia Jobs oraz Core. `relationJoins` jest opcją generatora Prisma, nie zmianą tabel; nie wymaga dodatkowej migracji SQL. Log `instagram_job_timing` rozdziela czas od przyjęcia webhooka do uruchomienia Jobs (`journalAgeMs`) i czas obsługi (`elapsedMs`). Log `quiz_delivery_timing` pokazuje przygotowanie, żądanie Meta i zapis wyniku (`prepareMs`, `metaMs`, `persistMs`). Zakończenie zadania obejmuje także porządki po wysyłce i nie oznacza chwili wyświetlenia DM na telefonie. Pomiary nie zawierają treści wiadomości ani tokenów.

### Testy quizów

Odpowiedzi Ścieżek są wysyłane bez dodatkowego przebiegu kolejki podczas obsługi zdarzenia w Jobs. Aktualizacja tego mechanizmu wymaga wdrożenia Workera Jobs; nie dodaje migracji ani bindingów. Limity konta i okno wiadomości nadal obowiązują. Pierwsze ponowienie po błędzie przejściowym czeka 60 sekund, a niepewna wysyłka wymaga sprawdzenia.

`npm test`, `npm run typecheck` i `npm run lint` sprawdzają kod. `npm run test:e2e:local` testuje panel na desktopie i mobile z kontrolowanymi odpowiedziami API; wymaga wcześniejszego `npm run build`.

Testy transakcji i pełnego przepływu używają opcjonalnego `QUIZ_TEST_DATABASE_URL` wskazującego **osobną, wcześniej zmigrowaną bazę PostgreSQL**. Nigdy nie wskazuj bazy aplikacji. Brak zmiennej oznacza jawne pominięcie tej części testów. Dla lokalnego PostgreSQL helper testowy łączy adapter Neon przez lokalny proxy WebSocket; żaden proxy nie jest wdrażany na Cloudflare. Testy tworzą własne losowe rekordy i usuwają tylko swoje dane.

```powershell
$env:QUIZ_TEST_DATABASE_URL='postgresql://TEST_USER:TEST_PASSWORD@127.0.0.1:5432/instascaler_test?sslmode=disable'
npx vitest run __tests__/quiz-postgres.test.ts
```

Test rzeczywistego Meta wykonaj na kontrolowanym poście z drugim uprawnionym kontem testowym: START → Zaczynamy → obie gałęzie quizu → testowy e-mail → STOP. Testy lokalne nie dowodzą dostarczenia DM przez produkcyjne API. Nie publikuj przykładowej ścieżki na losowych postach.

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

Core korzysta z bindingu usługowego `JOBS_API`, który wskazuje na `instascaler-jobs`, entrypoint `ManualMessages`. Dzięki niemu ręczne wiadomości ze skrzynki są wysyłane przez Jobs z limitem konta. Binding obsługuje również `processEvent`: po trwałym dodaniu zdarzenia do kolejki Core rozpoczyna obsługę w Jobs bez oczekiwania na konsumenta. Kolejka pozostaje ścieżką awaryjną. Binding nie wymaga nowego sekretu ani publicznego endpointu. Wdrażaj Jobs przed Core, aby entrypoint był dostępny.

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

Core ma placement `aws:eu-central-1`, zgodny z regionem używanej bazy Neon. Przy przeniesieniu bazy zmień region w `wrangler.core.jsonc`. Prywatne wywołanie Jobs pochodzi z Core; nie włączamy placement dla konsumenta kolejki, którego ta opcja nie dotyczy. Wdrożenie metody `processEvent` wymaga kolejności Jobs → Core.

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

Aktualizacja nie wymaga nowej migracji bazy ani dodatkowego zasobu Cloudflare. Dziennik R2 zawiera teraz także `follow-ups/` z opóźnionymi zadaniami i `control/` z kursorami odzyskiwania. Zachowaj te obiekty; usuwanie ich poza mechanizmem retencji może przerwać odzyskiwanie. Przyjęcie zdarzenia i dzienne liczniki są zapisywane atomowo w istniejącym Neon.

1. W Meta for Developers utwórz aplikację i dodaj Instagram Login oraz Webhooks.
2. Wpisz App ID i App Secret jako `META_APP_ID` oraz `META_APP_SECRET` w sekretach Core.
3. Dodaj dokładny OAuth redirect: `https://YOUR-INSTASCALER-DOMAIN.example/api/instagram/callback`.
4. Ustaw callback webhooka: `https://YOUR-INSTASCALER-CORE.example/webhook`; jako verify token użyj wartości `META_WEBHOOK_VERIFY_TOKEN`.
5. Zasubskrybuj `comments`, `messages` i `messaging_postbacks`. Ostatnie pole jest potrzebne do obsługi przycisków wiadomości otwierającej i potwierdzenia obserwowania. W trybie Development dodaj swoje konto Facebook/Instagram jako testera. Produkcja wymaga spełnienia bieżących wymagań i review Meta.
6. Zaloguj się do panelu, otwórz **Ustawienia** i wybierz **Połącz Instagram**. Po aktualizacji istniejącej instalacji połącz konto ponownie, aby odświeżyć subskrypcję webhooków.

Wymagania zdarzeń wiadomości i przycisków opisuje [oficjalna kolekcja Instagram API Meta](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-af579d08-121e-4897-8f45-5fd41ace49df).

## 8. Test końcowy i diagnostyka

```powershell
npm test
npm run typecheck
npm run lint
ggshield secret scan commit-range "HEAD^!"
git status --short
```

Z innego konta dodaj komentarz pasujący do aktywnej kampanii. Sprawdź wiadomość otwierającą, przycisk, wymaganie obserwowania, dostarczenie linku, wiadomość opóźnioną i logi. Gdy OAuth zwraca błąd, porównaj znak po znaku redirect URL z Meta. Gdy webhook nie przechodzi weryfikacji, sprawdź callback i `META_WEBHOOK_VERIFY_TOKEN`. Brak `comments`, `messages` lub `messaging_postbacks` zatrzymuje odpowiedni przepływ. Po świeżym klonie zainstaluj lokalny hook GitGuardian: `ggshield install --mode local`.

Lokalne testy interfejsu uruchom osobno:

```powershell
npm run build
npm run test:e2e:local
```

Przeglądarka Chromium musi być zainstalowana dla Playwright (`npx playwright install chromium`). Testy uruchamiają gotowy build na `127.0.0.1:3137` i przechwytują zapytania API, używając wyłącznie danych testowych. Nie wymagają produkcyjnego loginu ani tokenu Meta. To test interfejsu; rzeczywiste dostarczanie wymaga osobnego scenariusza z kontem testowym Meta.

## 9. Publikacja open source

Przed publicznym push: usuń lokalne domeny i dane kont, sprawdź `git status`, przeskanuj tylko ostatni commit poleceniem `ggshield secret scan commit-range "HEAD^!"` i nie commituj `.env`. Hook pre-commit sprawdza wyłącznie zmiany przygotowane do commita; skan przed pushem obejmuje tylko `HEAD`, bez wcześniejszych commitów. Pełną historię skanuj tylko na wyraźne żądanie użytkownika.
