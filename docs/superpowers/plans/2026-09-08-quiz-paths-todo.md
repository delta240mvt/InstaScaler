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
- [ ] 13. Testy całości, dokumentacja, commit, push i Cloudflare

Test Meta z rzeczywistym odbiorcą wymaga wskazanego konta testowego; szkic demonstracyjny nie jest automatycznie publikowany.

Etapy 1–12 są zaimplementowane. `npm test`: 284 testy PASS, w tym rzeczywisty izolowany PostgreSQL i adapter Neon. Pełny test podpisanego webhooka → R2 → Queue → Jobs → PostgreSQL z atrapą wyłącznie Meta przechodzi, łącznie z błędnym e-mailem i starym przyciskiem. Test nie oznacza wysyłki na prawdziwym Instagramie.

Build OpenNext, walidacja Prisma, typecheck, lint i dry-run Jobs/Core zakończyły się kodem 0. Migracja produkcyjna została zastosowana po wykonaniu spójnej kopii danych; `prisma migrate status` potwierdził aktualny schemat.

Pełne testy przeglądarkowe: 56 PASS, 2 celowo pominięte testy menu mobilnego w projekcie desktop. Nowy moduł ma 14 przypadków desktop/mobile. Po wcześniejszym opóźnieniu wylogowania końcowy pełny przebieg z jednym workerem zakończył się kodem 0. Testy PostgreSQL mają jawny limit 30 sekund; końcowy pełny zestaw `npm test` zakończył się kodem 0.

Pozostało: commit, skan ostatniego commita, push, wdrożenie Jobs → Core → Web z tagiem `main` i sprawdzenie produkcji.

Kontrola powdrożeniowa wykryła brak /paths w przekierowaniu logowania Web. Uzupełniono matcher i dodano cztery testy regresji. API od początku wymagało ważnej sesji. Lokalne sekrety logowania są placeholderami, a narzędzie istniejącej sesji przeglądarki było niedostępne; produkcyjne CRUD z ważną sesją nie zostało sprawdzone. Testy Hono na rzeczywistej bazie potwierdzają sesję i same-origin; produkcyjny panel zostanie sprawdzony z kontrolowanymi odpowiedziami API.
