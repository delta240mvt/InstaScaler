# Ścieżki: quiz komentarz → DM i baza leadów

Data: 2026-09-08. Status: zatwierdzona przez użytkownika 2026-09-08 („jest ok”); podstawa planu implementacji.

## 1. Cel i uzgodniony zakres

Osobny moduł administracyjny „Ścieżki” pozwala właścicielowi InstaScalera budować rozgałęzione rozmowy na Instagramie, maksymalnie po 10 kroków na całą automatyzację, łącznie ze Startem i Zakończeniem. Jest to uproszczenie zlecone przez użytkownika 2026-09-08 po zatwierdzeniu pierwotnego projektu. Odbiorca wybiera potrzeby, otrzymuje dopasowane wyjaśnienia, narzędzia i darmowe materiały, a aplikacja zapisuje jego odpowiedzi i zainteresowania we własnej bazie.

Pierwsze wejście: komentarz START pod wybranym postem → prywatna wiadomość z przyciskiem „Zaczynamy” → kliknięcie odbiorcy → quiz. Admin może zmienić treść wiadomości, CTA, słowo wyzwalające i zakres postów. Sam komentarz nie uruchamia serii kolejnych DM bez interakcji odbiorcy.

Produkt na tym etapie służy właścicielowi istniejącej instancji. Kontakty i przebieg rozmów pozostają w Neon używanym przez InstaScaler. Folder portalu referencyjnego pozostaje bez zmian.

## 2. Wartościowy lead

Obsługujemy wszystkie uzgodnione kryteria:

| Kryterium | Co stanowi dowód |
| --- | --- |
| Pozostawienie e-maila | Poprawny składniowo adres zapisany przez krok zbierania danych; nie oznacza potwierdzenia własności adresu. |
| Zainteresowanie pomocą lub ofertą | Wybrana odpowiedź lub dotarcie do jawnie skonfigurowanej akcji zainteresowania. |
| Konkretna odpowiedź lub tag | Dopasowanie zapisanej wartości albo obecność wybranego tagu. |
| Ukończenie etapu | Zapisane ukończenie wskazanego kroku, a nie samo wysłanie pytania. |

Domyślna reguła: poprawny e-mail LUB wyrażone zainteresowanie pomocą/ofertą. Admin może wybrać dowolne kryteria i połączyć je jako „dowolny warunek” lub „wszystkie warunki”. W pierwszej wersji wystarcza jedna lista warunków z wyborem OR/AND, bez dowolnie zagnieżdżonych formuł i bez scoringu AI.

Kwalifikacja jest liczona osobno dla udziału kontaktu w danej ścieżce. Profil kontaktu pokazuje ścieżki, w których spełnił regułę, wraz z powodami i datami. Pozwala to uniknąć przenoszenia kwalifikacji z jednej oferty na inną. Filtr „wartościowe kontakty” oznacza osoby zakwalifikowane w co najmniej jednej ścieżce.

Reguły są częścią opublikowanej wersji ścieżki. Zmiana szkicu nie przelicza niejawnie historycznych kwalifikacji. Poprawienie odpowiedzi w bieżącym przebiegu powoduje ponowną ocenę jego reguły. Odbiorca może pominąć opcjonalny e-mail i kontynuować rozmowę.

Podanie adresu e-mail nie jest automatyczną zgodą na newsletter. Pierwsza wersja zbiera dane kontaktowe i nie wysyła marketingowych e-maili. Zainteresowanie ofertą oznaczamy na podstawie jawnego wyboru, nie domysłu z dowolnego tekstu.

## 3. Moduł administracyjny

### Automatyzacje

Lista ścieżek z nazwą, kontem, stanem publikacji i liczbą rozpoczętych, ukończonych oraz zakwalifikowanych przebiegów. Działania: utworzenie, edycja, duplikowanie, publikacja i wstrzymanie nowych wejść.

Wyłączenie nowych wejść pozwala dokończyć już rozpoczęte rozmowy. Osobna akcja awaryjna zatrzymuje również trwające przebiegi. Te dwie operacje muszą mieć różne etykiety i jednoznaczny opis skutków.

### Edytor

Plansza kroków i połączeń, panel ustawień zaznaczonego kroku oraz podgląd rozmowy. Admin edytuje całą ścieżkę bez zmieniania kodu. Każda odpowiedź ma własne połączenie; gałęzie mogą zbiegać się w jeden wspólny krok.

Typy kroków:

1. **Start:** konto, posty, słowo kluczowe, treść pierwszego DM i CTA.
2. **Wiadomość:** tekst oraz opcjonalny zewnętrzny link do materiału lub narzędzia. Podanie nazwy materiału ułatwia późniejszy przegląd historii.
3. **Pytanie:** przyciski pojedynczego wyboru, tekst albo e-mail; zapis odpowiedzi do wskazanego pola. Pola mogą być wymagane lub opcjonalne. Format i liczba przycisków respektują możliwości wybranego payloadu Instagram API.
4. **Warunek:** rozgałęzienie według zapisanej odpowiedzi, pola, tagu lub ukończonego etapu, z jawną ścieżką alternatywną.
5. **Zapis danych:** dodanie/usunięcie tagu, ustawienie pola lub oznaczenie zainteresowania pomocą/ofertą.
6. **Zakończenie:** zakończenie rozmowy albo przekazanie jej administratorowi. Przekazanie zatrzymuje automatyczne kroki tego przebiegu.

Edytor pokazuje prostą planszę z maksymalnie 10 kartami kroków i połączeniami. Obsługuje przesuwanie kart, duplikowanie kroków w ramach limitu oraz usuwanie i poprawianie połączeń. Licznik „Kroki: 7/10” pokazuje wykorzystanie limitu. Wyszukiwarka kroków, minimapa i rozbudowane sterowanie przybliżeniem nie są potrzebne. Nazwy robocze nie trafiają do odbiorcy. Zapis szkicu ma widoczny stan powodzenia lub błędu i ostrzega przed opuszczeniem niezapisanego edytora.

Podgląd korzysta z tej samej logiki przejść i walidacji co wykonanie, lecz nie wysyła wiadomości do Meta i nie tworzy prawdziwych kontaktów. Pozwala zacząć od początku, wybierać odpowiedzi i obejrzeć powstające pola, tagi oraz kwalifikację.

### Kontakty i wyniki

Lista z wyszukiwaniem i filtrami: konto Instagram, ścieżka, tag, obecność e-maila, zainteresowanie ofertą, kwalifikacja i stan przebiegu. Wyniki są stronicowane. Profil zawiera źródłowy post, odpowiedzi, tagi, zapisane pola, historię kroków, pokazane materiały, datę ostatniej aktywności i powód kwalifikacji.

„Pokazano materiał” oznacza zarejestrowaną skuteczną wysyłkę wiadomości z nim, nie potwierdzenie przeczytania. Kliknięcie linku jest osobnym zdarzeniem, jeśli włączono jego pomiar. Statystyki nie utożsamiają kliknięcia ani deklarowanego zainteresowania z zakupem.

Admin może poprawić dane kontaktu i tagi oraz usunąć kontakt wraz z odpowiedziami i przebiegami. Usunięcie zatrzymuje jego oczekujące kroki. Techniczne zapisy deduplikacji nie przechowują w tym celu e-maila ani odpowiedzi użytkownika.

## 4. Limit 10 kroków i powroty

Limit całego grafu wynosi 10 kroków, wliczając wszystkie gałęzie, Start i Zakończenie. Egzekwują go edytor, API i publikacja. Przy dziesiątym kroku dodawanie i duplikowanie są zablokowane; usunięcie kroku zwalnia miejsce. Kryterium testowe: 10 kroków da się zapisać, opublikować i przejść, a jedenasty jest odrzucany także po bezpośrednim wywołaniu API.

Po każdej zaakceptowanej odpowiedzi zapisujemy bieżący krok, odpowiedź, zmiany pól/tagów i kwalifikację. Błąd lub restart Workera nie powoduje rozpoczęcia od nowa. Przebieg oczekujący na odbiorcę nie zużywa stale działającego procesu ani odpytywania w pętli.

Powtórny komentarz START przy trwającym przebiegu proponuje kontynuację albo świadome rozpoczęcie od początku. Restart zamyka poprzedni przebieg i tworzy nowy na aktualnie opublikowanej wersji; zachowuje profil kontaktu i historię, ale bieżące odpowiedzi quizu zaczynają się od nowa. W danym koncie Instagram jeden kontakt ma najwyżej jeden aktywny przebieg quizu. Rozpoczęcie innej ścieżki wymaga jawnego wyboru odbiorcy.

Graf nie dopuszcza cykli. Ponowne rozpoczęcie obsługuje osobna operacja. Warunki i akcje można przeliczyć lokalnie do następnego pytania, wiadomości albo zakończenia, w granicy 10 kroków. Nie potrzebujemy dodatkowych zadań Queue do porcjowania dużego grafu. Trwałe zadania pozostają wyłącznie dla wysyłki wiadomości i jej odzyskania po awarii.

Odbiorca może przerwać quiz komendą STOP. Ponowienie starego webhooka nie otwiera zatrzymanej rozmowy. Ponowne wejście wymaga nowej świadomej interakcji.

## 5. Wersje i publikacja

Ścieżka ma edytowalny szkic i niezmienne opublikowane wersje. Przebieg jest przypięty do wersji od chwili rozpoczęcia; istniejąca rozmowa nie przechodzi automatycznie na nową wersję podczas edycji.

Publikacja waliduje: jeden start, poprawne typy i identyfikatory kroków, istniejące cele połączeń, wymagane odpowiedzi i ścieżkę alternatywną warunku, osiągalność kroków, brak cykli, poprawność pól i reguł kwalifikacji oraz limity treści Meta. Błędy wskazują konkretne kroki na planszy.

Reguły wyzwalania nie mogą powodować podwójnej odpowiedzi istniejącej kampanii i quizu. Publikacja blokuje wykryte konflikty aktywnych wyzwalaczy w tym samym koncie i zakresie postów. Runtime dodatkowo wybiera jedną obsługę zdarzenia: dopasowaną ścieżkę lub dotychczasową kampanię. Nie wykonuje obu.

## 6. Wykonanie i ograniczenia Instagrama

Pierwszy prywatny DM odpowiada na komentarz. Następne kroki rozpoczynają się po prawidłowej interakcji odbiorcy. Każda fizyczna wysyłka sprawdza aktualne prawo wysyłki, aktywność konta i istniejący limiter konta.

Czas ostatniej interakcji pochodzi ze zweryfikowanego zdarzenia Meta; ponowienie Queue nie może go odświeżać. Wygaśnięcie okna zatrzymuje dalszą wysyłkę do następnej uprawnionej interakcji. Samo istnienie oczekującego kroku nie jest zgodą na wysłanie DM. W module nie ma bezwarunkowych wielodniowych sekwencji wychodzących.

Przyciski identyfikują przebieg, wersję, krok i odpowiedź; backend sprawdza powiązanie z kontem i odbiorcą. Dwa równoczesne kliknięcia, stary przycisk, niepasujący odbiorca i powtórzone zdarzenie nie mogą przesunąć przebiegu dwukrotnie. Nieprawidłowy e-mail zatrzymuje użytkownika na pytaniu i pokazuje jasną prośbę o poprawienie adresu, z możliwością pominięcia kroku opcjonalnego.

Wiadomości obsługiwane jako odpowiedź na aktywny quiz nie wyzwalają równocześnie starych automatyzacji słów kluczowych. Przejęcie rozmowy przez admina wstrzymuje odpowiedzi quizu; wznowienie jest jawną akcją.

## 7. Dane i granice implementacji

Koncepcyjne encje do odwzorowania w Prisma wraz z migracją:

- **Kontakt:** unikalny w obrębie konta Instagram i identyfikatora odbiorcy, z e-mailem, polami i tagami. Nie łączymy automatycznie osób między kontami na podstawie e-maila.
- **Ścieżka i wersja:** konfiguracja wejścia, graf kroków, reguła kwalifikacji i układ planszy. Graf ma walidowany, wersjonowany format danych; nie zawiera wykonywalnego kodu użytkownika.
- **Przebieg:** kontakt, wersja, źródło wejścia, stan, bieżący krok, czas ostatniej uprawnionej interakcji i wynik kwalifikacji.
- **Zdarzenie/krok przebiegu:** odpowiedź, przejście, zmiana danych lub wynik wysyłki ze stabilnym identyfikatorem do deduplikacji. Ewidencja wysyłki umożliwia odzyskiwanie pracy po przerwaniu procesu.

Pola kontaktu opisują profil długoterminowy; odpowiedzi należą też do konkretnego przebiegu, aby ponowne podejście nie nadpisywało historii. Indeksy i ograniczenia unikalności obejmują kontakt w koncie, aktywny przebieg, identyfikatory zdarzeń i stronicowane filtry operacyjne.

Web odpowiada za panel. Core odpowiada za uwierzytelnione CRUD, walidację, przyjęcie webhooka i trwały dziennik. Jobs wykonuje przejścia i wysyłkę przez obecny limiter. Neon przechowuje stan, R2 dziennik zdarzeń, a obecna Queue dostarcza zadania. Nie dodajemy osobnego serwera, Redis ani kolejnej usługi kolejkowania.

Logika grafu powinna być niezależna od transportu Meta i możliwa do przetestowania bez sieci. Rozszerzamy istniejącą normalizację o potrzebne dane odpowiedzi i źródłowy czas zdarzenia. Nie pomijamy podpisu, normalizacji, journal-before-queue, budżetów i deduplikacji.

Ponowienia dotyczą jawnie przejściowych błędów. Nie obiecujemy dokładnie jednokrotnej wysyłki, jeśli Meta przyjmie wiadomość, ale połączenie zostanie przerwane przed odebraniem odpowiedzi. Taki niejednoznaczny wynik musi być widoczny diagnostycznie i nie może prowadzić do nieograniczonego ponawiania całej sekwencji.

Endpointy panelu wymagają obecnej sesji admina, kontroli pochodzenia mutacji i walidacji Zod. Dane kontaktów nie trafiają do publicznych raportów ani zwykłych logów. Operacje usuwania i retencji uwzględniają oczekujące zadania, aby nie odtworzyły usuniętych danych. Linki do materiałów są walidowane; pierwsza wersja nie wykonuje dowolnych zapytań HTTP skonfigurowanych przez użytkownika.

## 8. Kryteria akceptacji

1. Admin buduje, zapisuje, ponownie otwiera i publikuje ścieżkę wyłącznie z panelu.
2. Komentarz START powoduje jeden otwierający DM; quiz czeka na „Zaczynamy”.
3. Dwie odpowiedzi prowadzą do różnych materiałów i tagów; gałęzie mogą wrócić do wspólnego kroku.
4. Poprawny e-mail albo jawne zainteresowanie kwalifikuje lead według reguły domyślnej. Niepoprawny adres nie kwalifikuje go jako kontaktu z e-mailem.
5. Wszystkie cztery kryteria kwalifikacji działają w trybach OR i AND, z widocznym uzasadnieniem wyniku.
6. Restart procesu, retry i równoczesne kliknięcia nie tracą odpowiedzi ani nie przesuwają przebiegu dwa razy.
7. Stary przycisk nie zmienia aktualnego kroku; edycja szkicu nie zmienia trwającej rozmowy.
8. STOP, pauza admina, wygaśnięcie okna i usunięcie kontaktu zatrzymują właściwe wysyłki.
9. Lista leadów filtruje po tagu, e-mailu, zainteresowaniu i ścieżce; profil pokazuje odpowiedzi i źródło.
10. Graf z 10 krokami przechodzi test zapisu, publikacji, podglądu i wykonania; krok jedenasty jest blokowany w UI i API.
11. Podgląd i testy z kontrolowanymi danymi nie wysyłają wiadomości na prawdziwe konta.
12. Dotychczasowe kampanie komentarz→DM, follow-gate, follow-up i skrzynka przechodzą testy regresji.

Testy obejmą logikę grafu, walidację publikacji, kwalifikację, uprawnienia panelu, migrację, współbieżność i okna wiadomości oraz E2E edytora i kontaktów. Przed wdrożeniem wymagane są sprawdzenia z AGENTS.md, w tym build Cloudflare i dry-run zmienionych Workerów. Osobny kontrolowany test na Instagramie potwierdzi rzeczywiste payloady przycisków i e-mail w rozmowie. Wynik testów z atrapami API nie zastępuje tej weryfikacji.

## 9. Poza pierwszą wersją

Follow-to-DM bez potwierdzonego dostępu Meta, wejście słowem kluczowym w nowym DM, Stories, pozostałe kanały, system wieloużytkownikowy, zewnętrzna baza portalu, marketing e-mailowy, AI, scoring punktowy, A/B, integracje sprzedażowe i ogólne wykonywanie zewnętrznych webhooków pozostają poza tym zakresem.

Gotowy quiz ma być konfigurowalnym scenariuszem demonstracyjnym z fikcyjnymi danymi. Nie publikujemy rzeczywistej oferty, linków ani automatyzacji na koncie bez skonfigurowania ich przez właściciela. Szczegółowe teksty pytań i materiały można uzupełnić w panelu; nie blokują projektu kreatora.

## 10. Źródła i następny etap

- Uzgodnienia w rozmowie z użytkownikiem z 2026-09-08: osobny moduł, komentarz START, pełna edycja, maksymalnie 10 kroków, własna baza, wszystkie warunki kwalifikacji. Późniejsza decyzja o limicie 10 zastępuje pierwotne założenie dużych grafów.
- Istniejący kod: prisma/schema.prisma, workers/core/routes/webhook.ts, lib/events/journal.ts, lib/jobs/contracts.ts, lib/delivery/runtime.ts, lib/core/tracked-redirect.ts.
- Ograniczenia prywatnych odpowiedzi: [oficjalna kolekcja Meta Instagram API](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-23eacf45-3728-4e41-bcc7-6d164959327c).

## Stan realizacji — 2026-09-08

Moduł został zaimplementowany na istniejącym branchu zgodnie z poleceniem pracy inline. Bieżąca lista wykonania i weryfikacji znajduje się w `../plans/2026-09-08-quiz-paths-todo.md`.

Testy integracji i całego przepływu połączono w `__tests__/quiz-postgres.test.ts`: korzystają z rzeczywistego izolowanego PostgreSQL i produkcyjnego adaptera Neon zamiast rozbudowanej atrapy persistence. Testy panelu są w `e2e/local-quiz.spec.ts`; atrapy API nie są dowodem wysyłki przez Meta. Logika grafu, edytora, kwalifikacji i okna wiadomości ma osobne małe testy. Nie dodano zależności ani usług produkcyjnych. Prace wykonano jako jeden spójny zestaw zmian; podział commitów z planu nie był wymagany do zachowania granic modułu.

Scenariusz demonstracyjny powstaje jako nieopublikowany szkic na żądanie administratora. Rzeczywisty test Instagram wymaga kontrolowanego odbiorcy i pozostaje osobnym sprawdzeniem po konfiguracji treści oraz postu.
