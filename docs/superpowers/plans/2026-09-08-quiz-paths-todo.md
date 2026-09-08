# Wykonanie modułu Ścieżki

Branch: `baza080926-extras`. Praca inline, bez nowego worktree.

- [x] 1. Kontrakty i walidacja grafu
- [x] 2. Reguły kwalifikacji i czysty silnik
- [x] 3. Baza i transakcje — rzeczywisty lokalny PostgreSQL przez adapter Neon
- [x] 4. CRUD, publikacje i konflikty wyzwalaczy
- [x] 5. START, normalizacja i przyciski
- [x] 6. Atomowe odpowiedzi i wykonanie
- [x] 7. Trwała wysyłka przez Queue i R2
- [x] 8. Odzyskiwanie, pauza, restart i usuwanie
- [x] 9. API kontaktów i historia
- [x] 10. Lista ścieżek i formularze
- [x] 11. Plansza do 10 kroków i podgląd
- [x] 12. Kontakty i sterowanie rozmową w panelu
- [x] 13. Testy całości, dokumentacja, commit, push i Cloudflare — zakres weryfikacji poniżej

Test Meta z rzeczywistym odbiorcą wymaga wskazanego konta testowego; szkic demonstracyjny nie jest automatycznie publikowany.

Etapy 1–12 są zaimplementowane. `npm test`: 284 testy PASS, w tym rzeczywisty izolowany PostgreSQL i adapter Neon. Pełny test podpisanego webhooka → R2 → Queue → Jobs → PostgreSQL z atrapą wyłącznie Meta przechodzi, łącznie z błędnym e-mailem i starym przyciskiem. Test nie oznacza wysyłki na prawdziwym Instagramie.

Build OpenNext, walidacja Prisma, typecheck, lint i dry-run Jobs/Core zakończyły się kodem 0. Migracja produkcyjna została zastosowana po wykonaniu spójnej kopii danych; `prisma migrate status` potwierdził aktualny schemat.

Pełne testy przeglądarkowe: 56 PASS, 2 celowo pominięte testy menu mobilnego w projekcie desktop. Nowy moduł ma 14 przypadków desktop/mobile. Po wcześniejszym opóźnieniu wylogowania końcowy pełny przebieg z jednym workerem zakończył się kodem 0. Testy PostgreSQL mają jawny limit 30 sekund; końcowy pełny zestaw `npm test` zakończył się kodem 0.

Kod został zapisany i wypchnięty na `baza080926-extras`: `334c38f` (moduł), `a016ead` (przekierowanie logowania). GitGuardian przed commitami i skan wyłącznie ostatniego commita przed push zakończyły się bez wykrytych sekretów.

Kontrola powdrożeniowa wykryła brak /paths w przekierowaniu logowania Web. Uzupełniono matcher i dodano cztery testy regresji. API od początku wymagało ważnej sesji. Lokalne sekrety logowania są placeholderami, a narzędzie istniejącej sesji przeglądarki było niedostępne; produkcyjne CRUD z ważną sesją nie zostało sprawdzone. Testy Hono na rzeczywistej bazie potwierdzają sesję i same-origin; produkcyjny panel został sprawdzony z kontrolowanymi odpowiedziami API.

Wdrożenie Jobs → Core → Web zakończyło się kodem 0, z tagiem `main`:

| Usługa | Wersja Cloudflare |
| --- | --- |
| Jobs | `3e2580c5-5744-4966-8b03-b04970e00714` |
| Core | `462d0741-0983-400d-8c39-ce0ea0583142` |
| Web | `88768eec-99e4-4af2-8bef-c12387d89016` |

Końcowy smoke test produkcji: health Core/Jobs 200; prywatne endpointy quizu bez sesji 401; strony /paths, /paths/contacts i /paths/preview bez sesji 307 do logowania; mutacja z obcego originu 403. Opublikowane ekrany i podgląd quizu przeszły test z kontrolowanymi danymi w przeglądarce, bez zapisu kontaktów i bez wysyłki DM. Po ostatniej poprawce ponownie przeszło wszystkich 14 testów panelu quizu. Lokalna testowa instancja PostgreSQL została zatrzymana.

Pozostają jawnie niezweryfikowane: produkcyjne operacje z rzeczywistą sesją administratora i dostarczenie DM przez Meta do kontrolowanego odbiorcy. Wdrożenie nie opublikowało żadnego quizu ani rzeczywistej oferty.
