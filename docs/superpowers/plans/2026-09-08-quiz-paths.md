# Editable Quiz Paths and Qualified Leads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dostarczyć osobny moduł „Ścieżki”: komentarz START → otwierający DM → edytowalny quiz, własna baza kontaktów i konfigurowalna kwalifikacja leadów.

**Architecture:** Czysta logika grafu będzie współdzielona przez podgląd i wykonanie. Core zapisuje konfigurację i przyjmuje podpisane zdarzenia, a Jobs wykonuje zapisane przejścia i wysyłkę przez obecny limiter. Neon przechowuje wersje, kontakty, przebiegi i trwałe zadania; istniejące R2, Queue i workflow odzyskiwania zapewniają dostarczenie po przerwaniu procesu.

**Tech Stack:** Next.js 16.2.12, React 19.2.4, TypeScript, Tailwind CSS 4, Hono, Zod, Prisma 7.9.1 z adapterem Neon, Cloudflare Workers/R2/Queues/Workflows/Durable Objects, Vitest i Playwright. Plansza v1 używa React, SVG i Pointer Events bez nowej zależności do edycji grafów.

**Spec:** `docs/superpowers/specs/2026-09-08-quiz-paths-design.md` — zatwierdzona przez użytkownika 2026-09-08.

**Korekta zakresu użytkownika:** maksymalnie 10 kroków na cały graf, ze Startem, Zakończeniem i wszystkimi gałęziami. Uproszczona plansza; bez funkcji dla dużych grafów i bez porcjowania obliczeń przez Queue.

## Global Constraints

- „Pierwsze wejście: komentarz START pod wybranym postem → prywatna wiadomość z przyciskiem „Zaczynamy” → kliknięcie odbiorcy → quiz.”
- „Domyślna reguła: poprawny e-mail LUB wyrażone zainteresowanie pomocą/ofertą.”
- „Admin może wybrać dowolne kryteria i połączyć je jako „dowolny warunek” lub „wszystkie warunki”.”
- „Podanie adresu e-mail nie jest automatyczną zgodą na newsletter.”
- „W danym koncie Instagram jeden kontakt ma najwyżej jeden aktywny przebieg quizu.”
- „Graf nie dopuszcza cykli.”
- Limit całego grafu: **10 kroków**, egzekwowany również przez API zapisu szkicu. Licznik kroków w panelu; jedenasty krok jest błędem walidacji.
- „Przebieg jest przypięty do wersji od chwili rozpoczęcia”.
- „Admin edytuje całą ścieżkę bez zmieniania kodu.”
- „Nie dodajemy osobnego serwera, Redis ani kolejnej usługi kolejkowania.”
- „Folder portalu referencyjnego pozostaje bez zmian.”
- „Dane kontaktów nie trafiają do publicznych raportów ani zwykłych logów.”
- Zachowaj polski interfejs, wspólne logo, Inter/IBM Plex Mono, obecne klasy i czytelne odstępy typografii. Brak zmian w folderze DELTA240MVT-PORTAL.
- Przeczytaj AGENTS.md, spec i wymienione pliki przed realizacją zadania. Przed zmianami Next.js przeczytaj właściwy przewodnik w `node_modules/next/dist/docs/`.
- Przed commitem skan wyłącznie staged przez lokalny hook; przed pushem `ggshield secret scan commit-range "HEAD^!"`. Nie uruchamiaj skanu całej historii.
- Pracuj na uzgodnionym `baza080926-extras`. Zachowaj zastane pliki nieśledzone. Nie używaj `git add .`.
- Plan nie uruchamia migracji ani nie publikuje automatyzacji. Podczas wykonania zmiany schematu i aplikacji mają osobne kontrole. Nie stosuj `db push`, resetu bazy ani destrukcyjnego cofania migracji.

## Kolejność i granice

To jeden moduł produktu z zależnościami, nie kilka niezależnych nowych usług. Zadania 1–4 budują testowalny model; 5–9 uruchamiają przepływ danych; 10–12 dostarczają panel; 13 sprawdza całość i wdrożenie. Nowe automatyzacje pozostają nieopublikowane do końca weryfikacji.

Przejrzane punkty integracji: `workers/core/routes/webhook.ts` normalizuje COMMENT/POSTBACK/MESSAGE; `lib/delivery/runtime.ts` realizuje stary prosty schemat; `lib/delivery/index.ts` pilnuje ProcessedEvent; `workers/jobs/workflows/services.ts` odzyskuje R2 i wykonuje retencję. Nie duplikuj tych mechanizmów i nie zakładaj, że samo ProcessedEvent chroni przed dwoma różnymi kliknięciami tego samego pytania.

### Mapa plików i odpowiedzialności

| Pliki | Odpowiedzialność |
| --- | --- |
| `lib/quiz/contracts.ts`, `graph.ts`, `qualification.ts`, `engine.ts`, `demo.ts` | Typy danych, walidacja grafu, reguły leadów, pojedyncze przejście, fikcyjny scenariusz. Bez Prisma, fetch i sekretów. |
| `lib/quiz/repository.ts`, `execution.ts` | Transakcje i atomowe zapisanie odpowiedzi/przejścia/zadania. |
| `lib/quiz/paths.ts`, `contacts.ts`, `trigger-conflicts.ts` | Operacje panelu, wersje, kontakty, konflikty wejść. |
| `lib/delivery/quiz.ts`, `quiz-work.ts`, `quiz-policy.ts`, `quiz-payload.ts` | Wybór ścieżki, wykonanie trwałej pracy, okna Meta, powiązanie przycisku z odbiorcą. |
| `lib/quiz/recovery.ts`, `privacy.ts` | Odzyskanie nieopublikowanych zadań, zatrzymanie i usuwanie danych. |
| `workers/core/routes/quiz-paths.ts`, `quiz-contacts.ts` | Uwierzytelnione endpointy panelu. |
| `lib/core-api/quiz-contracts.ts`, `client.ts`, `errors.ts` | Kontrakty odpowiedzi, klient i polskie komunikaty. |
| `app/(dashboard)/paths/page.tsx`, `paths/[id]/page.tsx`, `paths/contacts/page.tsx`, `paths/contacts/[id]/page.tsx` | Strony osobnego modułu. |
| `components/quiz/paths-list.tsx`, `editor.tsx`, `canvas.tsx`, `node-form.tsx`, `qualification-form.tsx`, `preview.tsx`, `contacts-list.tsx`, `contact-detail.tsx` | Małe komponenty panelu. |
| `lib/quiz/editor-state.ts` | Czyste operacje edytora i wspólny model połączeń. |
| `prisma/schema.prisma`, nowa migracja | Kontakty, wersje, przebiegi, zdarzenia i zadania do wykonania. |
| `test-support/quiz-fixtures.ts`, nowe `__tests__/quiz-*.test.ts`, `e2e/local-quiz.spec.ts`, `e2e/quiz-fixtures.ts` | Testy kontraktów, błędów, współbieżności i panelu. |

## Wspólne kontrakty implementacji

Wprowadź poniższe nazwy w Zadaniu 1. Zadania używają ich bez alternatywnych synonimów. Zod jest źródłem walidacji runtime; typy można wyprowadzić ze schematów. Dopuszczalne szkice mogą mieć puste cele połączeń; publikacja wymaga kompletności.

```ts
export type Value = string | number | boolean | null;
export type Criterion =
  | { kind: "email" }
  | { kind: "interest" }
  | { kind: "tag"; value: string }
  | { kind: "answer"; nodeId: string; value: Value }
  | { kind: "field"; key: string; value: Value }
  | { kind: "completed"; nodeId: string };
export type RuleGroup = { mode: "any" | "all"; rules: Criterion[] };
export type NodeBase = { id: string; label: string; x: number; y: number };
export type QuizNode = NodeBase & (
  | { type: "start"; keyword: string; postIds: string[]; allPosts: boolean;
      text: string; cta: string; next: string }
  | { type: "message"; text: string; material?: { name: string; url: string }; next: string }
  | { type: "question"; text: string; input: "choice" | "text" | "email";
      field: string; required: boolean; next: string;
      choices: Array<{ id: string; label: string; value: string; next: string }> }
  | { type: "condition"; when: RuleGroup; yes: string; no: string }
  | { type: "action"; addTags: string[]; removeTags: string[];
      setFields: Record<string, Value>; interest?: boolean; next: string }
  | { type: "end"; outcome: "completed" | "human" }
);
export type QuizGraph = { schemaVersion: 1; nodes: QuizNode[]; qualification: RuleGroup };
export type QuizDraft = { name: string; instagramAccountId: string; graph: QuizGraph };
export type Snapshot = {
  nodeId: string; phase: "ready" | "waiting" | "completed" | "human" | "stopped";
  answers: Record<string, Value>; fields: Record<string, Value>; tags: string[];
  email: string | null; interest: boolean; completedNodeIds: string[];
};
export type QuizInput = { kind: "answer"; value: string; choiceId?: string }
  | { kind: "skip" } | { kind: "stop" };
export type QuizMessage = { text: string; buttons: Array<
  { kind: "answer"; id: string; label: string } | { kind: "skip"; label: string }
>; material?: { name: string; url: string } };
export type Transition = {
  after: Snapshot; outbound?: QuizMessage;
  error?: "INVALID_EMAIL" | "ANSWER_REQUIRED" | "INVALID_CHOICE" | "UNEXPECTED_INPUT";
};
export type Qualification = { qualified: boolean; reasons: string[] };
export type GraphIssue = { nodeId?: string; code: string; message: string };
```

Pierwszy transport używa istniejącego button template: maksymalnie 3 przyciski, tekst z przyciskami do 640 znaków, etykieta do 20 znaków; opcjonalne pytanie rezerwuje miejsce na „Pomiń”. Zwykły tekst do 1000 znaków, pola e-mail do 254, odpowiedź tekstowa do 1000. Są to limity walidowane przed publikacją, bez cichego obcinania odpowiedzi. Linki materiałów tylko HTTPS, bez danych logowania w URL. Materiał może być linkiem w treści zamiast kolejnym przyciskiem.

Wybierz stałe ochronne w `contracts.ts`: `MAX_QUIZ_NODES = 10`, 64 KiB szkicu, 10 warunków w grupie, 50 tagów i 50 pól kontaktu (profil może zbierać dane z kilku quizów). Wszystkie bezsieciowe przejścia mieszczą się w jednej pętli do 10 iteracji. Nie dodawaj planowania ani porcjowania obliczeń grafu. Wartości ograniczają rozmiar żądań i pracę serwera, nie czas życia rozmowy.

Źródło dostępności button template: [oficjalna kolekcja Meta](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api). Przed testem rzeczywistym potwierdź bieżące payloady dla Instagram Login; nie przenoś funkcji Messenger-only.

## Task 1: Kontrakty, kompletny graf i scenariusz demonstracyjny

**Files:** Create `lib/quiz/contracts.ts`, `lib/quiz/graph.ts`, `lib/quiz/demo.ts`, `__tests__/quiz-graph.test.ts`.

**Interfaces:** Produces `parseQuizDraft(input: unknown): QuizDraft`, `validateGraph(graph: QuizGraph): GraphIssue[]`, `createDemoGraph(): QuizGraph`, `makeSizedGraph(length: number): QuizGraph` (ostatni tylko w `test-support/quiz-fixtures.ts`). `createDemoGraph` ma start, wybór „Materiał”/„Pomoc”, rozgałęzienia tagujące, wspólne opcjonalne pytanie o e-mail i koniec; cały przykład mieści się w 10 krokach.

- [ ] Dodaj test cyklu i gałęzi bez celu:

```ts
import { expect, it } from "vitest";
import { createDemoGraph } from "@/lib/quiz/demo";
import { validateGraph } from "@/lib/quiz/graph";
it("points at a cycle instead of allowing an endless delivery", () => {
  const graph = createDemoGraph();
  const start = graph.nodes.find(n => n.type === "start");
  if (!start || start.type !== "start") throw new Error("Missing fixture start");
  start.next = start.id;
  expect(validateGraph(graph)).toEqual(expect.arrayContaining([
    expect.objectContaining({ nodeId: start.id, code: "CYCLE" }),
  ]));
});
```

- [ ] Uruchom `npx vitest run __tests__/quiz-graph.test.ts`; oczekiwany FAIL przed implementacją.
- [ ] Zaimplementuj schematy Zod wszystkich wariantów, `.strict()`, ograniczenia rozmiaru oraz zakaz kluczy `__proto__`, `prototype`, `constructor`. Rozróżnij poprawność strukturalną szkicu od publikowalności grafu. Szkic może być niedokończony; kod źródłowy lub nieznany typ węzła nigdy nie jest poprawnym szkicem.
- [ ] Waliduj identyfikatory, jeden start, cele, osiągalność, cykle i istnienie pól/kroków w warunkach. Iteracyjna analiza węzłów korzysta z mapy, bez rekurencji zależnej od długości quizu. Wygeneruj mapę krawędzi według typów:

```ts
export function targets(node: QuizNode): string[] {
  if (node.type === "end") return [];
  if (node.type === "condition") return [node.yes, node.no];
  if (node.type === "question" && node.input === "choice") {
    return [...node.choices.map(choice => choice.next), ...(!node.required ? [node.next] : [])];
  }
  return [node.next];
}
```

- [ ] Dodaj testy zbiegania dwóch gałęzi, duplikatów ID, pustej reguły kwalifikacji, 4 przycisków, niedozwolonego URL, 10 i 11 kroków oraz polskich znaków. `makeSizedGraph(10)` tworzy start, 8 wiadomości i koniec. `makeSizedGraph(11)` musi zostać odrzucony przez parseQuizDraft, nie dopiero publikację. Przykład rozgałęziony również ma najwyżej 10 kroków.
- [ ] Uruchom ponownie test pliku; oczekiwany PASS. Commit tylko nowych plików: `feat: define validated quiz graphs`.

## Task 2: Reguły leadów i czysty silnik jednego kroku

**Files:** Create `lib/quiz/qualification.ts`, `lib/quiz/engine.ts`, `__tests__/quiz-qualification.test.ts`, `__tests__/quiz-engine.test.ts`; extend `test-support/quiz-fixtures.ts`.

**Interfaces:** Consumes Task 1. Produces `qualify(rule: RuleGroup, snapshot: Snapshot): Qualification`, `initialSnapshot(graph: QuizGraph, profile?: Partial<Pick<Snapshot, "email" | "fields" | "tags">>): Snapshot`, `advanceNode(graph: QuizGraph, current: Snapshot, input?: QuizInput): Transition`. Start transport nie należy do silnika: initialSnapshot wskazuje `start.next`, dopiero po prawidłowym CTA.

- [ ] Test domyślnej kwalifikacji:

```ts
it("uses OR for email or declared interest and explains the result", () => {
  const state = initialSnapshot(createDemoGraph());
  const rule: RuleGroup = { mode: "any", rules: [{ kind: "email" }, { kind: "interest" }] };
  expect(qualify(rule, state).qualified).toBe(false);
  expect(qualify(rule, { ...state, email: "osoba@example.com" }))
    .toEqual({ qualified: true, reasons: ["email"] });
  expect(qualify({ ...rule, mode: "all" }, { ...state, email: "osoba@example.com" }).qualified).toBe(false);
});
```

- [ ] Uruchom `npx vitest run __tests__/quiz-qualification.test.ts __tests__/quiz-engine.test.ts`; najpierw FAIL.
- [ ] Implementuj kryteria jako skończony switch; reasons to stabilne identyfikatory (`email`, `interest`, `tag:<value>`, `answer:<nodeId>`, `field:<key>`, `completed:<nodeId>`), tłumaczone w UI. Pusta grupa nigdy nie kwalifikuje. E-mail jest normalizowany przez trim i walidowany, nie oznaczany jako zweryfikowany. Stan interest zmienia wyłącznie jawna skonfigurowana akcja.

```ts
const matches = rule.rules.map(criterion => evaluateCriterion(criterion, snapshot));
const qualified = matches.length > 0 && (rule.mode === "all"
  ? matches.every(item => item.matched) : matches.some(item => item.matched));
return { qualified, reasons: matches.filter(item => item.matched).map(item => item.reason) };
```

`evaluateCriterion(criterion: Criterion, snapshot: Snapshot): { matched: boolean; reason: string }` jest prywatną funkcją w qualification.ts.

- [ ] Zaimplementuj przejścia: message emituje i proponuje następny krok; question w fazie ready emituje pytanie i proponuje waiting; waiting przyjmuje odpowiedź, zapisuje `answers[node.id]`, aktualizuje wskazane pole i dopiero oznacza krok jako ukończony. Wybrany przycisk zapisuje jego zadeklarowane value, nigdy tekst payloadu otrzymany jako dowolna wartość.
- [ ] Action zmienia pola/tagi/interest i przechodzi dalej; condition wybiera jedną krawędź; end ustawia completed/human. STOP ma pierwszeństwo i daje stopped. Optional skip nie tworzy fałszywej odpowiedzi; invalid email zachowuje obecny krok i nie kwalifikuje. Funkcja nie mutuje wejściowego obiektu.
- [ ] Dodaj testy tabelaryczne wszystkich kryteriów OR/AND, pytania wyświetlonego vs ukończonego, błędnego e-maila, skip, tekstu, deterministyczności, braku mutacji i przejścia 10 kroków przez kolejne wywołania.
- [ ] Ponów testy; PASS. Commit: `feat: evaluate quiz steps and lead qualification`.

## Task 3: Trwały model danych i transakcje przebiegu

**Files:** Modify `prisma/schema.prisma`; Create `prisma/migrations/20260908000000_quiz_paths/migration.sql`, `lib/quiz/repository.ts`, `__tests__/quiz-repository.test.ts`, `test-support/quiz-store.ts`, `__tests__/quiz-postgres.test.ts`; Modify `.env.example` (wyłącznie opcjonalna zmienna testowej bazy), `INSTRUKCJA.md` (test izolowany).

**Interfaces:** `QuizDb = ReturnType<typeof createPrisma>` w repository.ts, `createQuizRepository(db: QuizDb)` produkuje metody z poniższej sekcji. Typ `QuizRepository` to `ReturnType<typeof createQuizRepository>`, używany przez execution; w testach podstawiaj zgodne jawne implementacje metod, nie atrapę całego Prisma.

Model danych — każda encja ma string id, createdAt/updatedAt tam, gdzie jest mutowalna:

| Model | Pola i wymagane indeksy |
| --- | --- |
| QuizContact | instagramAccountId FK, participantKey (SHA-256 konta i IGSID), instagramUserId nullable, username nullable, email nullable, fields Json, tags String[], lastInteractionAt nullable, deletedAt nullable. Unique(account, participantKey), index(account, updatedAt), index(account, email), GIN(tags). |
| QuizPath | instagramAccountId FK, name, draft Json, draftRevision Int, publishedVersionId nullable, acceptsEntries Boolean, halted Boolean. Index(account, acceptsEntries). |
| QuizVersion | pathId FK, number Int, graph Json, createdAt. Unique(pathId, number); brak endpointu update/delete używanej wersji. |
| QuizRun | contactId/pathId/versionId FK, status, snapshot Json, revision Int, sourceCommentId/sourcePostId, lastInteractionAt nullable, qualified Boolean, qualificationReasons String[], qualifiedAt nullable, finishedAt nullable. Index(pathId, status, createdAt), index(contactId, createdAt), index(pathId, qualified, createdAt). |
| QuizEvent | runId FK, externalId unique, nodeId nullable, kind, data Json, createdAt. Index(runId, createdAt). Zawiera historię odpowiedzi/etapów, bez powielania całego webhooka. |
| QuizWork | runId FK, externalId unique, revision Int, status PENDING/SENDING/SENT/CANCELLED/FAILED/UNKNOWN, payload Json, afterSnapshot Json nullable, r2Key nullable, messageId nullable, createdAt, updatedAt. Wyłącznie zadanie wysyłki, bez kolumny rodzaju pracy. Index(status, updatedAt), index(runId, revision). |

Dodaj `QUIZ_STEP` do JobKind; źródło tych zadań to INTERNAL. Relacje kontakt→run→event/work usuwają dane osobowe przy żądaniu usunięcia; wersji wykorzystywanej przez run nie wolno usunąć. Tombstone kontaktu zachowuje tylko participantKey, account i deletedAt. Nie przechowuje e-maila, IGSID, pól ani odpowiedzi. Przyszły nowy komentarz może świadomie reaktywować kontakt; stary journal nie może.

Metody repozytorium mają transakcyjne implementacje:

```ts
type CommitTransition = {
  runId: string; expectedRevision: number; externalId: string;
  nodeId: string; after: Snapshot; qualification: Qualification;
  outbound?: QuizMessage; now: Date;
};
// commitTransition(input: CommitTransition): Promise<"applied" | "duplicate" | "stale" | "blocked">
// findRun(id: string): Promise<RunRecord | null>
// RunRecord: id, contactId, pathId, versionId, status, snapshot: Snapshot,
// revision, sourceCommentId, sourcePostId, lastInteractionAt: Date | null.
```

Te typy są eksportowane z repository.ts. Osobne metody admission i wysyłki opisują zadania 5–7; nie implementuj nieużywanych metod na zapas.

- [ ] Napisz test dwóch różnych eventów z tym samym expectedRevision; tylko jeden ma wynik applied, powstaje jeden stan oczekujący i maksymalnie jedno QuizWork. W test-support/quiz-store.ts wykonuj compare-and-swap atomowo, z kontrolowaną barierą Promise, a nie przez sekwencyjne wywołanie dwóch stubów.
- [ ] Uruchom `npx vitest run __tests__/quiz-repository.test.ts`; oczekiwany FAIL.
- [ ] Dodaj Prisma i migrację addytywną. W SQL wymuś jedną aktywną rozmowę:

```sql
CREATE UNIQUE INDEX "QuizRun_one_active_per_contact" ON "QuizRun" ("contactId")
WHERE "status" IN ('WAITING_START','ACTIVE','WAITING_REPLY','WAITING_WINDOW','PAUSED','HUMAN','UNKNOWN');
CREATE INDEX "QuizContact_tags_gin" ON "QuizContact" USING GIN ("tags");
```

Statusy końcowe: COMPLETED, STOPPED, RESTARTED, FAILED. Statusy dodaj jako enum Prisma. `QuizWork.status=SENDING` nigdy nie jest automatycznie uznawany za bezpieczny do ponownego wysłania.
- [ ] Implementuj transakcję: blokada wiersza kontaktu, kontrola aktywnego run i revision, wstawienie eventu, zmiany profilu/kwalifikacji oraz QuizWork albo zatwierdzenie przejścia. Zmiana stanu po SEND czeka na wynik API; accepted answer zapisuje się przed przygotowaniem następnego pytania. Nie wykonuj fetch do Meta wewnątrz transakcji.
- [ ] Dodaj rzeczywisty test częściowego indeksu i rollbacku transakcji na izolowanym PostgreSQL. `QUIZ_TEST_DATABASE_URL` musi różnić się od aplikacyjnego DATABASE_URL; test odmawia działania, jeśli wartości są równe. Brak zmiennej oznacza jawny skip lokalnie, nie PASS integracji. Test nie resetuje bazy ani schematu; tworzy fikcyjne rekordy z losowym sufiksem i usuwa tylko swoje rekordy. Uruchom migracje osobno na wskazanej bazie testowej przed tym testem.
- [ ] `npm run db:generate`, `npx prisma validate`, testy repository i postgres. Sprawdź, że migracja nie usuwa starych tabel. Commit: `feat: persist versioned quiz runs and contacts`.

## Task 4: CRUD ścieżek, wersje i konflikty wyzwalaczy

**Files:** Create `lib/quiz/paths.ts`, `lib/quiz/trigger-conflicts.ts`, `workers/core/routes/quiz-paths.ts`, `lib/core-api/quiz-contracts.ts`, `__tests__/quiz-paths.test.ts`; Modify `workers/core/index.ts`, `lib/automations/service.ts`, `lib/core-api/client.ts`, `lib/core-api/errors.ts`.

**Interfaces:** `createPath(db: QuizDb, draft: QuizDraft): Promise<PathDetail>`, `saveDraft(db, id, expectedRevision, draft): Promise<PathDetail>`, `publishPath(db, id, expectedRevision): Promise<PathDetail>`, `setPathState(db, id, acceptsEntries, halted): Promise<PathDetail>`, `duplicatePath(db, id): Promise<PathDetail>`. Db to QuizDb; id string, revision number, state boolean. `PathDetail` w quiz-contracts.ts: id, name, instagramAccountId, draft, draftRevision, publishedVersionId, acceptsEntries, halted, createdAt/updatedAt jako ISO string, metrics {started, completed, qualified}. Lista to istniejące `Page<PathDetail>` z domyślnym pageSize=25 i max=100.

- [ ] Napisz test saveDraft z nieaktualną wersją zwracający 409 bez nadpisania danych i test publish niekompletnego grafu zwracający `quiz_invalid_graph` z GraphIssue[]. Uruchom `npx vitest run __tests__/quiz-paths.test.ts`; FAIL.
- [ ] Publikuj pod blokadą wiersza InstagramAccount, wspólną dla modyfikacji aktywnych kampanii i ścieżek. Sprawdź draftRevision, graph i konflikty; utwórz nową QuizVersion i przełącz wskaźnik atomowo. Konflikt to ten sam zakres postów oraz wspólne słowo albo matchAnyWord. Dla złożonych wariantów dopasowania stosuj konserwatywne porównanie i wyjaśnienie w panelu. W runtime nadal obowiązuje jedna wybrana obsługa eventu, także gdy komentarz zawiera słowa kilku różnych kampanii.
- [ ] Kontrola działa również przy create/update/import starej kampanii i ponownym włączeniu ścieżki; nie wystarczy sprawdzać tylko publikacji nowego modułu. Import zachowuje obecne wyniki per wiersz i dodaje powód konfliktu. Zmiany transakcyjnej sygnatury AutomationStore propaguj do bezpośrednich wywołań i testów.
- [ ] Zarejestruj chronione trasy, stosując istniejące requireAdmin i globalne requireSameOrigin:

```text
GET    /api/quiz-paths?page=1&pageSize=25&instagramAccountId=...
POST   /api/quiz-paths                       body QuizDraft
GET    /api/quiz-paths/:id
PUT    /api/quiz-paths/:id/draft             body { expectedRevision, draft }
POST   /api/quiz-paths/:id/publish           body { expectedRevision }
POST   /api/quiz-paths/:id/duplicate
PATCH  /api/quiz-paths/:id/state             body { acceptsEntries, halted }
```

- [ ] Przykład testu autoryzacji: `await app.request('/api/quiz-paths', { method: 'POST', body: '{}' }, env)` bez cookie ma 401; poprawna sesja i obcy Origin mają 403; walidacja Zod zwraca 400 bez wycieku danych wejściowych. Twórz env i cookie zgodnie z istniejącymi testami auth; żadnego obchodzenia middleware dla E2E.
- [ ] Dodaj `coreApi.quizPaths` z list/get/create/saveDraft/publish/duplicate/setState, odpowiedzi `{data}`; CoreApiError zachowuje bezpieczne `issues?: GraphIssue[]` potrzebne edytorowi. Kody: `quiz_revision_conflict`, `quiz_trigger_conflict`, `quiz_invalid_graph`, `quiz_path_not_found` z polskimi komunikatami.
- [ ] Uruchom testy quiz-paths i core-automations; PASS. Commit: `feat: manage quiz drafts and immutable publications`.

## Task 5: Normalizacja zdarzeń, START i bezpieczne przyciski

**Files:** Modify `workers/core/routes/webhook.ts`, `lib/delivery/runtime.ts`, `lib/events/journal.ts`; Create `lib/delivery/quiz.ts`, `lib/delivery/quiz-payload.ts`, `lib/delivery/quiz-policy.ts`, `lib/quiz/execution.ts`, `__tests__/quiz-entry.test.ts`, `__tests__/quiz-payload.test.ts`, `__tests__/quiz-policy.test.ts`; Extend repository.ts.

**Interfaces:** `routeQuizEvent(db: QuizDb, env: JobsEnv, envelope: EventEnvelope): Promise<JobResult | null>` — null oznacza brak przejęcia eventu i pozwala staremu runtime kontynuować. `createQuizEntry(db, input): Promise<{ runId: string; workId: string } | { blocked: true }>` w execution.ts przyjmuje accountId, instagramUserId, username nullable, pathVersionId, commentId, postId, externalId, occurredAt, receivedAt. Typy string poza datami Date. Quiz entry tworzy WAITING_START i pracę pojedynczego otwierającego DM, bez wykonywania initialSnapshot.

`encodeQuizPayload(data: QuizButtonContext): string` i `decodeQuizPayload(raw: string): QuizButtonContext | null`; context {runId, versionId, revision, nodeId, choiceId, action: 'start'|'answer'|'skip'|'continue'|'restart'|'switch'}. Krótki prefiks `quiz1:`; wszystkie części walidowane. Payload nie zawiera e-maila ani odpowiedzi tekstowej. Backend sprawdza konto/odbiorcę i faktycznie dostarczony krok; sam poprawny format nie autoryzuje wykonania.

- [ ] Napisz regresję: COMMENT START tworzy jedno opening work i WAITING_START, a zero pytań quizu; duplikat commentId nie tworzy kolejnego run. Dwa różne komentarze jednego kontaktu nie omijają unikalnego aktywnego przebiegu. Uruchom trzy nowe pliki testów; FAIL.
- [ ] Rozszerz envelope payload o `occurredAt` w ISO i dla odpowiedzi `quickReplyPayload`, jeśli obecny. Zachowaj oddzielnie receivedAt. Timestamp messaging pochodzi z messaging.timestamp (ms), komentarza z value.timestamp albo entry.time (s); brak/niepoprawna/przyszła wartość nie otwiera 24h. Timestamp z kolejkowego retry nigdy nie zastępuje źródłowego czasu. Nie zmieniaj stabilnych externalId starych eventów.
- [ ] Dla entry bez wiarygodnego czasu komentarza odczytaj oficjalne metadane komentarza przed przyjęciem, przez ograniczoną operację Meta w Jobs, lub zwróć bezpieczne diagnostic `QUIZ_COMMENT_TIME_UNKNOWN`; nie wymyślaj czasu utworzenia z odbioru webhooka. Recovery z polling przekazuje comment.timestamp.
- [ ] Konto i user muszą pasować do run przy kliknięciu. Dopiero start CTA inicjuje wykonanie. Nieznany prefiks postback pozostaje dla istniejącego runtime; rozpoznany, ale niepoprawny quiz payload jest obsłużony jako skipped i nie trafia do starej kampanii.
- [ ] Umieść integrację przed dotychczasowymi gałęziami dostawy:

```ts
const quizResult = await routeQuizEvent(db, context.env, envelope);
if (quizResult !== null) return quizResult;
// Existing COMMENT/POSTBACK/MESSAGE branches remain below this point.
```

Nie przechwytuj wiadomości osób bez quizu. Tekstowe odpowiedzi aktywnego quizu i STOP są przechwytywane przed keyword DM. Pauza/human nadal blokuje automatyzacje słów kluczowych dla tej rozmowy.
- [ ] Implementuj `canSendQuizMessage({ now, lastInteractionAt, commentCreatedAt, opening, blocked }): boolean`, wszystkie daty Date|null. Opening wymaga dozwolonego wieku komentarza i niewysłanego opening work; standardowy DM wymaga now < lastInteractionAt + 24h. Waliduj źródłowe timestampy przed ich przyjęciem. Testy graniczne 24h, opóźniona Queue, obcy user, stary przycisk, tekst START wewnątrz odpowiedzi.
- [ ] Testy nowych plików i istniejących core-webhook-regressions, webhook-journal, delivery; PASS. Commit: `feat: admit comment quizzes and validate replies`.

## Task 6: Atomowe odpowiedzi i trwałe wykonanie kolejnych kroków

**Files:** Extend `lib/quiz/execution.ts`, `repository.ts`; Create `__tests__/quiz-execution.test.ts`; Extend test-support/quiz-store.ts.

**Interfaces:** `acceptQuizInput(db: QuizDb, input: { runId: string; expectedRevision: number; externalId: string; instagramUserId: string; instagramAccountId: string; nodeId: string; input: QuizInput; occurredAt: Date }): Promise<'accepted'|'stale'|'duplicate'|'blocked'>`. `advanceQuizRun(db: QuizDb, runId: string, expectedRevision: number, now: Date): Promise<{ workId: string | null; state: string }>` przelicza warunki i akcje lokalnie do najbliższej wiadomości/pytania albo końca. Cały graf ma najwyżej 10 kroków, więc nie produkuje zadań do dalszych obliczeń. Używa advanceNode i qualify, nie własnych odmiennych reguł.

- [ ] Test: dwie różne odpowiedzi na revision=4 rywalizują przez barierę; tylko jedna zapisuje answer, tag i następne pytanie. Ponowienie zwycięskiego externalId zwraca duplicate. Uruchom `npx vitest run __tests__/quiz-execution.test.ts`; FAIL.
- [ ] Rozdziel zaakceptowanie odpowiedzi od wysyłki następnego kroku. Najpierw transakcja zapisuje odpowiedź i nowe READY/ACTIVE; dopiero kolejne wywołanie produkuje SEND z proponowanym afterSnapshot. SEND nie publikuje następnego pytania, dopóki poprzednie nie zostało rozstrzygnięte.
- [ ] Zablokuj wiersz kontaktu i run; kontroluj expectedRevision, snapshot.nodeId, aktywną wersję i dostarczony prompt. CAS i unikalny event są wymagane razem. Do QuizEvent zapisuj minimalną treść zaakceptowanej odpowiedzi oraz źródłowy nodeId. Wpływ na Contact i qualification zatwierdzaj w tej samej transakcji.

```ts
// In the transaction, after reading the current locked run:
if (run.revision !== input.expectedRevision || run.snapshot.nodeId !== input.nodeId) return "stale";
const transition = advanceNode(graph, run.snapshot, input.input);
const result = qualify(graph.qualification, transition.after);
// commitTransition writes the event, profile, qualification and possible SEND atomically.
```

- [ ] Błędna odpowiedź powoduje najwyżej jeden komunikat walidacyjny dla danego externalId; nie zmienia ukończonego etapu ani kwalifikacji. Optional skip ma osobne znaczenie. Samo wysłanie promptu nie oznacza completedNodeIds.
- [ ] Dodaj test restartu między zapisem odpowiedzi i wysłaniem, dwóch równoczesnych wejść w różne ścieżki, zachowania starej wersji oraz przejścia 10 kroków. Sekwencja samych warunków i akcji ma dojść do wiadomości albo końca lokalnie, bez dodatkowych obliczeniowych jobów.
- [ ] Testy PASS. Commit: `feat: persist atomic quiz transitions and checkpoints`.

## Task 7: Dostawa QuizWork przez obecną Queue i R2

**Files:** Create `lib/delivery/quiz-work.ts`, `__tests__/quiz-work.test.ts`; Modify `lib/jobs/contracts.ts`, `lib/events/journal.ts`, `lib/delivery/index.ts`, `lib/delivery/runtime.ts`, `workers/jobs/index.ts`, `lib/meta/client.ts`, `lib/quiz/repository.ts`, `lib/quiz/execution.ts`.

**Interfaces:** `journalQuizWork(bucket: JournalBucket, job: QuizStepJob): Promise<QuizStepJob & { r2Key: string }>`, `dispatchQuizWork(db: QuizDb, env: JobsEnv, workId: string): Promise<boolean>`, `deliverQuizWork(db: QuizDb, env: JobsEnv, job: QuizStepJob): Promise<JobResult>`.

```ts
export type QuizStepJob = {
  version: 1; kind: "QUIZ_STEP"; externalId: string;
  instagramAccountId: string; workId: string; r2Key?: string;
};
// externalId = `quiz-work:${workId}`; Queue payload has no message text or personal data.
```

Przy dispatch r2Key staje się wymagany; parser kolejki odrzuca QUIZ_STEP bez niego. Journal `quiz-steps/<hash>.json` zawiera tę samą referencję, nie całe dane kontaktu.

- [ ] Test crash po zapisaniu work przed wysłaniem do Queue: work pozostaje PENDING; R2 put kończy się przed queue.send; odrzucony budżet niczego nie wysyła. Uruchom `npx vitest run __tests__/quiz-work.test.ts`; FAIL.
- [ ] Zapisz journal, zarezerwuj budżet przez istniejące reserveQueueJob, opublikuj mały job. Po błędzie publikacji PENDING i journal pozostają do odzyskania. Każda faktyczna próba publikacji jest rozliczona, a retry używa obecnego reserveQueueRetry.
- [ ] QUIZ_STEP korzysta z ProcessedEvent i tego samego processInstagramJob i oznacza wyłącznie wysyłkę. Weryfikuj zgodność kind/externalId/account/workId z R2 i DB. Dodaj INTERNAL dla nowego rodzaju. Kontroluj konto, stan run, work, okno wysyłki i limiter bezpośrednio przed fetch. Po zatwierdzonej wysyłce advanceQuizRun lokalnie oblicza kolejną pracę albo oczekiwanie na odbiorcę.
- [ ] Dodaj `sendQuizMessage(token: string, instagramAccountId: string, recipient: {id: string} | {comment_id: string}, message: {text: string; buttons: Array<{title: string; payload: string}>}): Promise<{recipient_id: string; message_id: string}>` do meta/client.ts. Bez przycisków używa text; z przyciskami button template. Cały payload walidowany wcześniej, brak cichego slice. Żadnych retry ukrytych wewnątrz tej funkcji.
- [ ] Przed fetch atomowo oznacz SEND jako SENDING; po otrzymaniu message_id zapisz SENT i afterSnapshot w jednej transakcji pod revision. Dopiero wtedy oznacz pokazany materiał i uruchom dalszą pracę. Równoległy worker nie wysyła SENDING ponownie.
- [ ] Jawne odrzucenie przez Meta z powodu limitu jest retry według klasyfikacji. Brak odpowiedzi/timeout lub przerwanie po przyjęciu bez zapisanego potwierdzenia oznacza UNKNOWN i wstrzymany przebieg. Recovery nie wysyła UNKNOWN ponownie. Prawidłowy przycisk z niejednoznacznie dostarczonej wiadomości może potwierdzić dostawę tylko po sprawdzeniu jej run/revision/node/odbiorcy; dopiero wtedy pozwól przyjąć odpowiedź. Nie oznaczaj całej sesji jako pomyślnie zakończonej po błędzie transportu.
- [ ] STOP/usunięcie mogą unieważnić gotowe zadanie. Sprawdź aktualny stan przed send i przed zatwierdzeniem afterSnapshot, aby nie wskrzesić run po równoległym stop. Wiadomości już zaakceptowanej przez Meta nie da się cofnąć; UI i test nie obiecują takiej gwarancji.
- [ ] Testy limiter denied, closed window, duplicated work, API accepted + DB failure, stale SENDING, token expired, obcy job, jawny transient i permanent error. Uruchom też jobs-consumer, delivery i journal-recovery; PASS. Commit: `feat: deliver durable quiz work through cloudflare`.

## Task 8: Odzyskiwanie, pauza, restart i usuwanie kontaktów

**Files:** Create `lib/quiz/recovery.ts`, `lib/quiz/privacy.ts`, `__tests__/quiz-recovery.test.ts`, `__tests__/quiz-lifecycle.test.ts`; Modify `workers/jobs/workflows/services.ts`, `lib/core/job-replay.ts`, `lib/quiz/execution.ts`, `lib/delivery/quiz.ts`, `lib/delivery/manual-message.ts`, `workers/core/routes/quiz-paths.ts`.

**Interfaces:** `recoverQuizWork(db: QuizDb, env: JobsEnv, now: Date): Promise<{ recovered: number; unknown: number }>`, `deleteQuizContact(db: QuizDb, env: CoreEnv, id: string, now: Date): Promise<void>`, `controlQuizRun(db: QuizDb, runId: string, action: 'pause'|'resume'|'stop'|'restart', now: Date): Promise<RunRecord>`.

- [ ] Test usunięcia po zakolejkowaniu pracy: odtworzenie tego samego R2, starego przycisku i starego comment externalId nie tworzy kontaktu i nie wysyła DM. Uruchom `npx vitest run __tests__/quiz-recovery.test.ts __tests__/quiz-lifecycle.test.ts`; FAIL.
- [ ] W istniejącym RecoverJournalWorkflow dodaj odzyskiwanie quiz-steps oraz do 100 najstarszych PENDING QuizWork bez skutecznego dispatch. Zapewnij indeks status/updatedAt, stabilny kursor i limit 500 łącznych rekordów na wykonanie. Wywołuj obecne reserveWorkflowStep i dispatchQuizWork. Nie twórz nowego Workera/schedulera/bindingu.
- [ ] SENDING starsze niż timeout transportu + margines przechodzi w UNKNOWN, nigdy PENDING. QUIZ_STEP przechodzi przez aktualny replay diagnostyczny tylko wtedy, gdy DB work nadal nadaje się do ponowienia. Zakończone/usunięte/UNKNOWN nie podlegają ręcznemu replay.
- [ ] Restart jest transakcją zamykającą poprzedni run jako RESTARTED przed utworzeniem nowego na aktualnej wersji. Nowe answers są puste; profil kontaktu pozostaje. Kontynuacja używa przypiętej starej wersji. Przejście do innej ścieżki wymaga kliknięcia dedykowanego switch przycisku; zwykły nowy komentarz nie przełącza sesji.
- [ ] HALTED blokuje również existing work; acceptsEntries=false blokuje wyłącznie nowe wejścia. Resume po upływie okna nie wysyła niczego do następnej uprawnionej interakcji. STOP zachowuje historię i anuluje oczekującą pracę; start nowego quizu wymaga nowego świadomego wejścia.
- [ ] Usuwanie: oznacz tombstone i zatrzymaj runs, usuń Event/Work i dane osobowe, zneutralizuj odpowiadające im ProcessedEvent jako SKIPPED, usuń znane R2. Odczyt tombstone ma miejsce przed admission. ReceivedAt i wiarygodny occurredAt starego wejścia muszą być sprzed deletedAt, więc replay nie reaktywuje kontaktu. Bez wiarygodnego czasu nie reaktywuj usuniętego kontaktu.
- [ ] Retencja czyści terminalne QuizWork i ich R2 po 90 dniach partiami po 500. Zachowuje odpowiedzi i kontakty do jawnego usunięcia; nie usuwa opublikowanych wersji, których używa historia. Nie kasuj technicznych dowodów eventu, jeżeli istniejący journal nadal mógłby odtworzyć jego skutki; rozszerz retencję w tym samym commicie i przetestuj tę kolejność.
- [ ] Dodaj `POST /api/quiz-runs/:id/control` z body {action}. Przy ręcznej wysyłce ze skrzynki automatycznie przełącz aktywny quiz tego odbiorcy do PAUSED przed send; błąd wysyłki pozostawia pauzę i pokazuje powód. Dla odbiorcy bez quizu dotychczasowa skrzynka działa tak samo.
- [ ] Testy uruchom z retention-audit, journal-recovery, manual-message i core-auth. PASS. Commit: `feat: recover and control quiz conversation lifecycle`.

## Task 9: API kontaktów, historia i kwalifikacja

**Files:** Create `lib/quiz/contacts.ts`, `workers/core/routes/quiz-contacts.ts`, `__tests__/quiz-contacts.test.ts`; Modify `workers/core/index.ts`, `lib/core-api/quiz-contracts.ts`, `lib/core-api/client.ts`, `lib/core-api/errors.ts`.

**Interfaces:** `listQuizContacts(db: QuizDb, query: ContactQuery): Promise<Page<ContactSummary>>`, `getQuizContact(db, id): Promise<ContactDetail|null>`, `updateQuizContact(db, id, patch: ContactPatch): Promise<ContactDetail>`; db QuizDb, id string.

`ContactQuery`: page/pageSize, instagramAccountId?, pathId?, tag?, hasEmail?, interested?, qualified?, status?, search?. `ContactPatch`: expectedUpdatedAt string, email string|null, fields Record<string,Value>, tags string[]. `ContactSummary`: id, instagramAccountId, username nullable, email nullable, tags, updatedAt ISO, qualified boolean. `ContactDetail` dodaje fields i stronicowane runs/events z ich wersją, sourcePostId, answers, qualified, reasons, lastInteractionAt. Nie ładuj nieograniczonej historii do jednego JSON.

- [ ] Test: qualified filter wybiera kontakt z dowolnym qualified run; pathId+qualified odnosi się do tej samej ścieżki, nie innego run osoby. Dane innego konta nie przenikają po samym e-mailu. Uruchom `npx vitest run __tests__/quiz-contacts.test.ts`; FAIL.
- [ ] Implementuj bounded Prisma queries i selecty bez accessToken. Przy edycji kontaktu kontroluj updatedAt i blokadę kontaktu, aby nie nadpisać nowej odpowiedzi z DM. Przelicz tylko aktywny przebieg na jego przypiętych regułach, zapisując event korekty; historyczne wyniki nie zmieniają się niejawnie.
- [ ] Trasy requireAdmin + requireSameOrigin:

```text
GET    /api/quiz-contacts
GET    /api/quiz-contacts/:id
GET    /api/quiz-contacts/:id/runs?page=1&pageSize=25
GET    /api/quiz-runs/:id/events?page=1&pageSize=50
PATCH  /api/quiz-contacts/:id
DELETE /api/quiz-contacts/:id
```

- [ ] Klient `coreApi.quizContacts` udostępnia list/get/runs/events/update/delete i `coreApi.quizRuns.control`. Kwalifikacja pokazuje przyczyny, nie tylko boolean. W pierwszej wersji nie włączaj per-recipient śledzenia linków: tekst „Materiał wysłany” pochodzi z potwierdzonego SEND; nie prezentuj nieistniejących kliknięć ani zakupów.
- [ ] Testy auth/origin, pageSize bounds, 404, tombstone niewidoczny, OR/AND z różnymi ścieżkami, konflikt edycji, brak sekretów w serializacji i usunięcie. PASS. Commit: `feat: query and manage qualified quiz contacts`.

## Task 10: Lista ścieżek i formularze edytora

**Files:** Create `app/(dashboard)/paths/page.tsx`, `app/(dashboard)/paths/[id]/page.tsx`, `components/quiz/paths-list.tsx`, `editor.tsx`, `node-form.tsx`, `qualification-form.tsx`, `lib/quiz/editor-state.ts`, `__tests__/quiz-editor-state.test.ts`, `e2e/quiz-fixtures.ts`, `e2e/local-quiz.spec.ts`; Modify `components/sidebar.tsx`, `playwright.local.config.ts`.

**Interfaces:** `QuizEditor({path}: {path: PathDetail})`; `NodeForm({node,graph,onChange}: {node: QuizNode; graph: QuizGraph; onChange(node: QuizNode): void})`; `QualificationForm({value,graph,onChange}: {value: RuleGroup; graph: QuizGraph; onChange(value: RuleGroup): void})`. Server route params to `Promise<{id:string}>`; interaktywny klient pobiera szczegóły przez Core, zgodnie z istniejącym panelem.

- [ ] Test czystego edytora: `deleteNode(graph,id): QuizGraph` usuwa węzeł i zeruje wskazujące na niego cele, aby publikacja ujawniła brak połączenia; nie wybiera arbitralnie innej ścieżki. `duplicateNode(graph,id,newId): QuizGraph` kopiuje treści z nowymi choice IDs i pozycją, bez skopiowania połączeń do nowych nieistniejących kroków. `connectNodes(graph,sourceId,port,targetId): QuizGraph` aktualizuje jedyne źródło prawdy w QuizNode. port to next/yes/no/choice:<id>.
- [ ] Uruchom `npx vitest run __tests__/quiz-editor-state.test.ts`; FAIL, zaimplementuj funkcje i testy startu, kasowania odpowiedzi i scalania gałęzi; PASS.
- [ ] Dodaj nawigację „Ścieżki”; lista ma utworzenie fikcyjnego szkicu, duplikację, status i metryki. Publiczne raporty pozostają bez nowych danych kontaktów.
- [ ] Formularze pokrywają wszystkie pola sześciu typów kroków i wszystkie kryteria RuleGroup. Warunki answer/completed korzystają z wybieraka istniejących kroków, nie ręcznego ID. Email/interest są osobnymi kryteriami; admin widzi OR/AND i powód błędu publikacji przy odpowiednim kroku.
- [ ] Zapisuj ze stanem dirty/saving/saved/error i expectedRevision. 409 zachowuje lokalny szkic oraz proponuje pobranie aktualnej wersji, bez automatycznego nadpisania. `beforeunload` chroni zamknięcie karty, a nawigacja wewnątrz panelu pyta tylko przy niezapisanych zmianach. Nie serializuj kontaktów do localStorage.
- [ ] Dodaj fixture API na bazie `fixtureApi(page)` z e2e/local-fixtures.ts, osobne trasy `/api/quiz-*`, zapis stanu szkicu w pamięci testu. Nie udawaj logowania do rzeczywistego Core; wszystkie testowe dane API są przechwycone. Dopisz local-quiz.spec.ts do testMatch.

```ts
test("keeps the editor draft after a failed save", async ({page}) => {
  await quizFixtureApi(page, {saveFailure: true});
  await page.goto("/paths/demo");
  await page.getByLabel("Nazwa ścieżki", {exact:true}).fill("Mój quiz");
  await page.getByRole("button", {name:"Zapisz szkic", exact:true}).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Nazwa ścieżki", {exact:true})).toHaveValue("Mój quiz");
});
```

`quizFixtureApi(page: Page, options?: {saveFailure?: boolean; revisionConflict?: boolean; fullGraph?: boolean}): Promise<void>` eksportuj z e2e/quiz-fixtures.ts. fullGraph oznacza dokładnie 10 kroków. Błędy 503 i 409 są osobnymi testami.
- [ ] Uruchom build potrzebny Playwright i testy edytora na desktop/mobile; PASS. Commit: `feat: add paths administration and editable step forms`.

## Task 11: Prosta plansza do 10 kroków i wspólny podgląd

**Files:** Create `components/quiz/canvas.tsx`, `components/quiz/preview.tsx`; Modify editor.tsx, editor-state.ts, e2e/local-quiz.spec.ts; Create `__tests__/quiz-preview.test.ts`.

**Interfaces:** `QuizCanvas({graph,selectedId,onSelect,onChange}: {graph: QuizGraph; selectedId:string|null; onSelect(id:string):void; onChange(graph:QuizGraph):void})`; `QuizPreview({graph}: {graph:QuizGraph})`. `simulateQuiz(graph: QuizGraph, inputs: QuizInput[]): {snapshot: Snapshot; messages: QuizMessage[]; qualification: Qualification}` w engine.ts używa advanceNode w granicy 10 kroków, bez transportu.

- [ ] Napisz test zgodności podglądu z silnikiem: ta sama sekwencja wyborów/e-mail daje te same answers/tags/reasons. Stub fetch rzuca w tym teście, aby wykryć przypadkowy transport. Uruchom `npx vitest run __tests__/quiz-preview.test.ts`; FAIL, następnie implementuj i PASS.
- [ ] W planszy HTML karty leżą nad SVG strzałek w przewijalnym kontenerze. Pointer capture obsługuje przesuwanie kart. Bez zoomu, minimapy i wyszukiwarki kroków. Przelicz współrzędne względem przewijanej planszy:

```ts
const graphX = event.clientX - bounds.left + container.scrollLeft;
const graphY = event.clientY - bounds.top + container.scrollTop;
```

- [ ] Połączenia ustawiaj dostępnym klawiaturą wyborem „Połącz z krokiem”; strzałki od razu pokazują wynik. Nie implementuj osobnego drag-and-drop portów. Strzałki są wyliczane z graph.nodes — nie utrzymuj drugiej sprzecznej tablicy edges. Usuwanie węzła nie przechwytuje Delete w polu tekstowym.
- [ ] Pozycje persistuj w szkicu. Na mobile formularz wybranego kroku otwiera się jako osobny panel, plansza pozostaje przewijalna bez poziomego rozsadzania strony. Focus i etykiety pozostają dostępne bez drag. Licznik pokazuje „Kroki: N/10”; po osiągnięciu limitu dodawanie i duplikowanie są wyłączone, usunięcie kroku je odblokowuje.
- [ ] Preview pokazuje wiadomości, wybory, text/email, skip, aktualne tagi i kwalifikację, restart testu. Błędna grafowa publikacja pokazuje problemy, nie uruchamia niekończącej się symulacji. Preview nie zapisuje kontaktów i nie korzysta z API Meta.
- [ ] Playwright: utwórz dwa rozgałęzienia i wspólny email w limicie 10, zapisz, odśwież, sprawdź połączenia, zmień regułę OR→AND i przejdź preview; druga karta edytora testuje 409. Fixture pełnego grafu ma 10 kroków; sprawdź edycję po reload, blokadę jedenastego kroku i duplikowania oraz zwolnienie miejsca po usunięciu. Sprawdź widoczne strzałki przez SVG path i wynik zapisanych połączeń, nie tylko screenshot.
- [ ] Build i `npx playwright test --config playwright.local.config.ts e2e/local-quiz.spec.ts`; oba projekty PASS. Obejrzyj screenshoty desktop/mobile. Commit: `feat: build visual quiz canvas and safe conversation preview`.

## Task 12: Kontakty, powody kwalifikacji i sterowanie rozmową

**Files:** Create `app/(dashboard)/paths/contacts/page.tsx`, `app/(dashboard)/paths/contacts/[id]/page.tsx`, `components/quiz/contacts-list.tsx`, `contact-detail.tsx`; Modify `app/(dashboard)/inbox/page.tsx`, e2e/quiz-fixtures.ts, e2e/local-quiz.spec.ts.

**Interfaces:** `QuizContactsList()` używa coreApi.quizContacts.list; `QuizContactDetail({id}:{id:string})` pobiera profil i strony historii. W szczegółach run używa coreApi.quizRuns.control. W skrzynce stan quizu jest odczytywany po jednoznacznym koncie i IGSID, nie po username.

- [ ] Dodaj E2E: kontakty A z e-mailem, B z zainteresowaniem, C bez kwalifikacji; filtr wartościowe ma A+B, filtr e-mail tylko A, filtr zainteresowanie tylko B. Kliknięcie profilu pokazuje konkretny powód i źródłowy post. Uruchom testy przed UI; FAIL.
- [ ] Zaimplementuj stronicowaną listę i filtry zachowane w query URL. Rozdziel dane profilowe od odpowiedzi w konkretnym przebiegu. Pokaż tekst „Adres niepotwierdzony”, nie oznaczaj automatycznie zgody marketingowej.
- [ ] Profil pokazuje oś zdarzeń i materiały wysłane, zakończenie, pauzę, WAITING_WINDOW i UNKNOWN z bezpiecznym objaśnieniem. Run control jest dostępne tylko dla aktualnego stanu; resume nie sugeruje, że wysyłka jest możliwa poza oknem. Osobna akcja usuwa kontakt i opisuje utratę odpowiedzi, zatrzymanie oczekujących kroków oraz niemożliwość cofnięcia już wysłanych DM.
- [ ] W skrzynce komunikuj aktywny quiz i pauzę po ręcznej odpowiedzi. Operator może jawnie wznowić quiz. Wysyłki istniejącego inbox poza quizem zachowują dotychczasową obsługę błędów.
- [ ] Testy E2E: edycja tagów, 409 przy konflikcie z nową odpowiedzią, dwa przebiegi tego samego kontaktu, pauza/resume, usunięcie oraz brak sekretów w widoku. Desktop i mobile, keyboard navigation i brak overflow. PASS. Commit: `feat: surface qualified leads and quiz conversation controls`.

## Task 13: Weryfikacja całości, dokumentacja i wdrożenie

**Files:** Create `__tests__/quiz-end-to-end.test.ts`; Modify `README.md`, `INSTRUKCJA.md`, `AGENTS.md`, docs spec (tylko stan realizacji i świadome odstępstwa), odpowiednie istniejące testy, `e2e/local-quiz.spec.ts`. Wrangler i lib/cloudflare/env.ts tylko jeśli rzeczywiście zmienią się bindingi; plan nie wymaga nowych.

**Interfaces:** Pełna ścieżka Hono webhook → journal → compact Queue → processInstagramJob → quiz runtime → atrapiony Meta fetch. Użyj istniejących helperów auth/Queue/R2, prawdziwej logiki silnika i deterministycznej atrapy persistence. Nie testuj logiki wyłącznie przez sprawdzenie, czy wywołano mock funkcji, która tę logikę zastępuje.

- [ ] Test z podpisanym webhookiem: START → opening → start CTA → dwie gałęzie → e-mail → kwalifikacja → koniec. Sprawdź R2 przed Queue, odpowiednie liczby wysyłek i limiter przed każdą, historię kontaktu oraz brak równoległego starego DM. Powtórz z inną gałęzią, STOP i niepoprawnym e-mailem.
- [ ] Test crash/restore: snapshot persistence i R2 zachowany między instancjami wykonawcy; odpowiedź po restarcie idzie do właściwego kroku. Osobno przerwij między create work/R2/Queue/send/confirm. UNKNOWN nie powoduje automatycznej duplikacji.
- [ ] Uruchom `npx vitest run __tests__/quiz-end-to-end.test.ts`; PASS. Uruchom izolowany test PostgreSQL z Zadania 3; jeśli brak bazy, odnotuj niezweryfikowaną migrację/concurrency i nie przedstawiaj ich jako sprawdzonych produkcyjnie.
- [ ] Uzupełnij README jako opis istniejących po implementacji funkcji i ograniczeń. INSTRUKCJA: tworzenie szkicu, publikacja, STOP/pauza, leady, testowe dane, migracja, weryfikacja i wyłączenie nowych wejść. AGENTS: nowy rodzaj QUIZ_STEP i jego journal, prywatność kontaktów, wersje i inwarianty. Nie zapisuj prawdziwych domen/sekretów.
- [ ] Wykonaj wymagane kontrole; każda musi zakończyć się kodem 0:

```powershell
npm run db:generate
npx prisma validate
npm test
npm run typecheck
npm run lint
npm run cf:build:web
npx wrangler deploy --dry-run --config wrangler.jobs.jsonc
npx wrangler deploy --dry-run --config wrangler.core.jsonc
npx playwright test --config playwright.local.config.ts
git diff --check
```

Typecheck i build nie powinny równocześnie modyfikować `.next/types`. E2E uruchom po buildzie, bez równoległego przebudowywania `.next`. Nie zmieniaj starego testu, aby ukryć regresję; napraw konflikt lub udokumentuj rzeczywiste wymaganie.
- [ ] Przygotuj kontrolowany test Meta: konto właściciela, wskazany przez niego post testowy i drugi uprawniony tester. Wyślij START, kliknij prawdziwe przyciski, wpisz syntetyczny adres `osoba@example.com`, sprawdź zapis i STOP. Bez dostępnych kont/zgody na interakcję raportuj ten etap jako nieprzeprowadzony; nie inicjuj prawdziwych DM do osób trzecich i nie publikuj demonstracyjnej ścieżki na przypadkowych postach.
- [ ] Przed migracją produkcyjną sprawdź status migracji oraz dostępność odzyskania bazy; nie resetuj niezgodnego stanu. Zastosuj wyłącznie nową addytywną migrację. Wdrożenie kodu nie włącza żadnej ścieżki. W razie regresji wyłącz nowe wejścia/halt, przywróć poprzedni kod, zachowaj nowe tabele i dane do diagnozy.
- [ ] Commit wyłącznie sprawdzonych plików; lokalny hook skanuje staged. Skan przed publicznym pushem tylko `ggshield secret scan commit-range "HEAD^!"`. Push na `baza080926-extras`, zgodnie z istniejącą autoryzacją użytkownika.
- [ ] Wdrażaj Jobs → Core → Web. Tag produkcyjny `main` to tag wersji Workers, nie osobne środowisko. Zachowaj --keep-vars, a komunikat OpenNext niech będzie samym hashem bez spacji:

```powershell
$quizReleaseCommit = git rev-parse --short HEAD
npx wrangler deploy --config wrangler.jobs.jsonc --tag main --message $quizReleaseCommit --keep-vars
npx wrangler deploy --config wrangler.core.jsonc --tag main --message $quizReleaseCommit --keep-vars
npx opennextjs-cloudflare deploy --config wrangler.web.jsonc --tag main --message $quizReleaseCommit --keep-vars
```

- [ ] Sprawdź /health, autoryzację nowych endpointów, panel /paths oraz preview z kontrolowanymi danymi po wdrożeniu. Wynik raportu końcowego rozdziela testy unit/integracyjne, przeglądarkowe z atrapami API i rzeczywisty test Meta. Podaj commit i wersje wdrożenia; nie ogłaszaj działającej automatyzacji na prawdziwym koncie, jeśli test Meta nie został wykonany.

## Macierz pokrycia specyfikacji

| Wymaganie | Zadania |
| --- | --- |
| START, opening CTA i jedno wybrane wejście | 4, 5, 7, 13 |
| Wszystkie kroki i pełna edycja admina | 1, 2, 10, 11 |
| Limit 10 kroków, zapis i restart procesu | 1, 3, 6, 7, 8, 11, 13 |
| Własne kontakty i cztery kategorie reguł OR/AND | 2, 3, 9, 10, 12 |
| Wersje i brak wpływu szkicu na rozpoczęty quiz | 3, 4, 5, 10, 13 |
| STOP, pauza, human, ponowny START, inna ścieżka | 5, 6, 8, 12 |
| Okno wiadomości, kolejka, limiter i niepewne wysyłki | 5, 6, 7, 8, 13 |
| Usuwanie danych bez odtworzenia przez retry | 3, 8, 9, 12, 13 |
| Materiał wysłany odróżniony od kliknięcia/zakupu | 7, 9, 12 |
| Preview bez prawdziwych kontaktów i Meta | 2, 10, 11, 13 |
| Brak regresji kampanii, inbox i harmonogramu | 4, 5, 7, 8, 12, 13 |
| Wygląd marki, polski UI, dostępność, mobile | 10, 11, 12, 13 |

## Stan kontroli planu

Plan odpowiada zatwierdzonej specyfikacji z późniejszym ograniczeniem użytkownika do 10 kroków. Usunięto obliczeniowe zadania do dzielenia dużego grafu, jego wyszukiwarkę, zoom, minimapę i przeciąganie portów. Zadania zależne od bazy i kolejki poprzedzają panel; testowy scenariusz jest fikcyjny. Zmiana bibliotek planszy, rozszerzenie zakresu kanałów lub zmiana zasad aktywnych rozmów wymaga jawnego odnotowania zmiany projektu. Ten dokument jest planem, nie raportem z wykonania powyższych testów.
