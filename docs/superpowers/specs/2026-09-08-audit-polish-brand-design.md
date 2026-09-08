# Audyt, polska wersja i marka DELTA240MVT

Zakres zatwierdzony przez użytkownika 8 września 2026: audyt i naprawy wszystkich istniejących przepływów, spolszczenie całego interfejsu i dopasowanie wyglądu do portalu DELTA240MVT. Realizacja na `baza080926-polish`.

## Granice

- Portal DELTA240MVT-PORTAL jest źródłem wyłącznie do odczytu.
- Zachowujemy architekturę Web → Core → R2/Queue → Jobs, Neon i istniejące Durable Objects/Workflows.
- Bez nowych usług i bibliotek do lokalizacji. Bez wdrożenia lub push.
- Nie tłumaczymy identyfikatorów API ani zapisanych przez użytkownika treści kampanii.
- Zastane pliki nieśledzone i artefakty pozostają nietknięte.

## Oczekiwany wynik

1. Inwentaryzacja logowania, OAuth i kont, kampanii/importu, komentarzy, postbacków, wiadomości, follow-gate, follow-up, skrzynki, raportów, przekierowań, limitów, retry i prac okresowych. Potwierdzone błędy mają regresje oraz minimalne poprawki.
2. Polski interfejs, walidacja, dostępność, szablony, strony publiczne, liczby i daty. Błędy techniczne mają bezpieczne polskie opisy.
3. Inter i IBM Plex Mono, czerń #020304, tło #F8F7F3, turkus #00D6D8, żółty #F2E500, fiolet #8F5BFF. Mocna typografia, czytelne obramowania, oszczędne prostokątne kontrolki. Fonty z polskimi znakami, dostępny kontrast i obsługa klawiatury.
4. Testy jednostkowe/integracyjne, interakcje przeglądarkowe desktop/mobile, typecheck, lint, build i dry-run Workerów. Raport jasno oddziela testy lokalne z kontrolowanymi danymi od prawdziwej wysyłki Meta.

## Punkt wyjścia

36 plików / 167 testów Vitest i typecheck przechodzą. Istnieją tylko dwa scenariusze Playwright zależne od E2E_*; zmiennych brak. Wiele testów UI sprawdza tekst źródłowy zamiast interakcji. Audyt ma zamknąć tę lukę, bez traktowania mocków jako dowodu działania produkcyjnego Meta.
