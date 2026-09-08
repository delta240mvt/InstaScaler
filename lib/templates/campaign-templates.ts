export interface CampaignTemplate {
  slug: string;
  title: string;
  category: string;
  audience: string;
  summary: string;
  goal: string;
  keywords: string[];
  dmMessage: string;
  triggerExample: string;
  privateReplyPreview: string;
  setupMinutes: number;
  outcome: string;
  bestFor: string[];
  playbook: string[];
  metrics: string[];
  accent: "cyan" | "emerald" | "rose" | "amber";
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    "slug": "dtc-product-link",
    "title": "Link do produktu",
    "category": "Sprzedaż w social media",
    "audience": "Marki sprzedające bezpośrednio",
    "summary": "Zamieniaj komentarze LINK lub SKLEP w wiadomość z linkiem do produktu, tabeli rozmiarów lub zestawu.",
    "goal": "Prośba o link do produktu",
    "keywords": [
      "LINK",
      "SKLEP",
      "KUP"
    ],
    "dmMessage": "Cześć {username}, oto link do wybranego produktu: https://example.com/produkt",
    "triggerExample": "LINK poproszę",
    "privateReplyPreview": "Cześć Maja, oto link do wybranego produktu: example.com/produkt",
    "setupMinutes": 4,
    "outcome": "Więcej rozmów z osobami zainteresowanymi produktem.",
    "bestFor": [
      "Premiery produktów",
      "Rolki klientów",
      "Kampanie z twórcami"
    ],
    "playbook": [
      "Wybierz post lub rolkę, która wyraźnie pokazuje produkt.",
      "Zacznij od słów LINK, SKLEP i KUP.",
      "Wyślij link do produktu z krótkim opisem korzyści.",
      "Sprawdź, które posty generują najwięcej wysłanych odpowiedzi."
    ],
    "metrics": [
      "Wysłane odpowiedzi",
      "Pominięte duplikaty",
      "CTR linku do produktu"
    ],
    "accent": "cyan"
  },
  {
    "slug": "real-estate-lead-form",
    "title": "Formularz zainteresowania nieruchomością",
    "category": "Pozyskiwanie kontaktów",
    "audience": "Agenci i biura nieruchomości",
    "summary": "Wysyłaj formularz wyceny, link do rezerwacji lub przewodnik po okolicy po komentarzu pod ofertą.",
    "goal": "Wysyłka bezpłatnego materiału",
    "keywords": [
      "DOM",
      "OFERTA",
      "WYCENA"
    ],
    "dmMessage": "Cześć {username}, tutaj znajdziesz szczegóły nieruchomości i terminy prezentacji: https://example.com/dom",
    "triggerExample": "DOM — poproszę szczegóły",
    "privateReplyPreview": "Cześć Jan, tutaj znajdziesz szczegóły nieruchomości i terminy prezentacji.",
    "setupMinutes": 5,
    "outcome": "Zbieraj zainteresowanie ofertą bez gubienia kontaktów w komentarzach.",
    "bestFor": [
      "Rolki z ofertami",
      "Przewodniki po okolicy",
      "Posty o wycenie"
    ],
    "playbook": [
      "Wybierz post o jednej nieruchomości lub lokalnym rynku.",
      "Użyj słów wskazujących na zainteresowanie zakupem.",
      "Wyślij formularz z danymi kontaktowymi i preferowanym terminem.",
      "Skontaktuj się osobiście z zainteresowanymi osobami."
    ],
    "metrics": [
      "Otwarcia formularza",
      "Wysłane wiadomości",
      "Umówione prezentacje"
    ],
    "accent": "emerald"
  },
  {
    "slug": "fitness-plan",
    "title": "Plan treningowy do pobrania",
    "category": "Kampanie twórców",
    "audience": "Trenerzy i twórcy fitness",
    "summary": "Wysyłaj plan treningowy, poradnik żywieniowy lub formularz konsultacji po komentarzu PLAN, TRENING lub START.",
    "goal": "Wysyłka bezpłatnego materiału",
    "keywords": [
      "PLAN",
      "TRENING",
      "START"
    ],
    "dmMessage": "Cześć {username}, oto bezpłatny plan z rolki: https://example.com/plan-treningowy",
    "triggerExample": "PLAN",
    "privateReplyPreview": "Cześć Ola, oto bezpłatny plan z rolki: example.com/plan-treningowy",
    "setupMinutes": 3,
    "outcome": "Zaproś zainteresowanych odbiorców na konsultację lub do newslettera.",
    "bestFor": [
      "Rolki treningowe",
      "Posty z metamorfozami",
      "Wyzwania"
    ],
    "playbook": [
      "Opublikuj rolkę pokazującą efekt i poproś o jedno słowo w komentarzu.",
      "Napisz krótką wiadomość skupioną na obiecanym materiale.",
      "Dodaj link do konsultacji po przekazaniu bezpłatnej wartości.",
      "Sprawdzaj błędy i pominięcia po rolkach o dużym zasięgu."
    ],
    "metrics": [
      "Prośby o poradnik",
      "Zapisy na wyzwanie",
      "Zapytania o trening"
    ],
    "accent": "rose"
  },
  {
    "slug": "course-webinar",
    "title": "Zaproszenie na webinar",
    "category": "Edukacja",
    "audience": "Autorzy kursów",
    "summary": "Wysyłaj linki do zapisu na webinar lub lekcję osobom komentującym WEBINAR, LEKCJA lub NAUKA.",
    "goal": "Lista oczekujących",
    "keywords": [
      "WEBINAR",
      "LEKCJA",
      "NAUKA"
    ],
    "dmMessage": "Cześć {username}, oto link do zapisu na bezpłatny webinar: https://example.com/webinar",
    "triggerExample": "WEBINAR",
    "privateReplyPreview": "Cześć Adam, oto link do zapisu na bezpłatny webinar: example.com/webinar",
    "setupMinutes": 4,
    "outcome": "Zamieniaj zasięg treści edukacyjnych w zapisy na webinar.",
    "bestFor": [
      "Premiery kursów",
      "Krótkie szkolenia",
      "Warsztaty na żywo"
    ],
    "playbook": [
      "Wybierz rolkę edukacyjną z konkretnymi przykładami.",
      "Użyj głównego słowa w opisie i dodaj dwa słowa alternatywne.",
      "Wyślij link do zapisu z datą lub opisem korzyści.",
      "Porównaj wyniki postów organicznych przed uruchomieniem reklam."
    ],
    "metrics": [
      "Zapisy",
      "Wysłane wiadomości",
      "Frekwencja"
    ],
    "accent": "amber"
  },
  {
    "slug": "beauty-price-list",
    "title": "Cennik usług beauty",
    "category": "Usługi lokalne",
    "audience": "Salony, spa i specjaliści beauty",
    "summary": "Odpowiadaj cennikiem i linkiem do rezerwacji na komentarze CENA, CENNIK lub TERMIN.",
    "goal": "Cennik lub dostępność",
    "keywords": [
      "CENA",
      "CENNIK",
      "TERMIN"
    ],
    "dmMessage": "Cześć {username}, oto nasze usługi i link do rezerwacji: https://example.com/rezerwacja",
    "triggerExample": "CENA",
    "privateReplyPreview": "Cześć Lena, oto nasze usługi i link do rezerwacji.",
    "setupMinutes": 4,
    "outcome": "Ogranicz powtarzalne odpowiedzi i ułatw rezerwację wizyty.",
    "bestFor": [
      "Rolki przed i po",
      "Posty z ofertą",
      "Wolne terminy"
    ],
    "playbook": [
      "Wybierz post, pod którym odbiorcy pytają o ceny.",
      "Dodaj link do rezerwacji z jasnym podziałem usług.",
      "Unikaj przesadzonych obietnic i twierdzeń medycznych.",
      "Aktualizuj link, gdy zmienia się cennik lub dostępność."
    ],
    "metrics": [
      "Kliknięcia rezerwacji",
      "Wysłane wiadomości",
      "Nowe wizyty"
    ],
    "accent": "rose"
  },
  {
    "slug": "restaurant-menu",
    "title": "Menu i rezerwacja stolika",
    "category": "Gastronomia",
    "audience": "Restauracje i kawiarnie",
    "summary": "Wysyłaj menu, link do rezerwacji lub ofertę wydarzenia po komentarzu MENU, STOLIK lub REZERWACJA.",
    "goal": "Prośba o link do produktu",
    "keywords": [
      "MENU",
      "STOLIK",
      "REZERWACJA"
    ],
    "dmMessage": "Cześć {username}, oto nasze menu i link do rezerwacji: https://example.com/menu",
    "triggerExample": "MENU",
    "privateReplyPreview": "Cześć Kuba, oto nasze menu i link do rezerwacji.",
    "setupMinutes": 3,
    "outcome": "Zamieniaj rolki kulinarne w rezerwacje i wyświetlenia menu.",
    "bestFor": [
      "Dania sezonowe",
      "Nowe menu",
      "Rezerwacje weekendowe"
    ],
    "playbook": [
      "Wybierz apetyczną rolkę i poproś o konkretne słowo w komentarzu.",
      "Wyślij menu lub stronę rezerwacji wygodną na telefonie.",
      "Informuj o ograniczonej liczbie miejsc tylko wtedy, gdy to prawda.",
      "Powtarzaj kampanię dla kolejnych ofert sezonowych."
    ],
    "metrics": [
      "Kliknięcia menu",
      "Rezerwacje",
      "Odpowiedzi w kampanii weekendowej"
    ],
    "accent": "amber"
  },
  {
    "slug": "event-rsvp",
    "title": "Zapisy na wydarzenie",
    "category": "Wydarzenia",
    "audience": "Organizatorzy i społeczności",
    "summary": "Wysyłaj formularz zapisu, link do kalendarza lub bilety po komentarzu ZAPIS, BILET lub DOŁĄCZ.",
    "goal": "Lista oczekujących",
    "keywords": [
      "ZAPIS",
      "BILET",
      "DOŁĄCZ"
    ],
    "dmMessage": "Cześć {username}, tutaj zapiszesz się na wydarzenie i znajdziesz szczegóły: https://example.com/zapis",
    "triggerExample": "ZAPIS",
    "privateReplyPreview": "Cześć Kasia, tutaj zapiszesz się na wydarzenie i znajdziesz szczegóły.",
    "setupMinutes": 4,
    "outcome": "Zamieniaj zainteresowanie wydarzeniem w mierzalne zapisy.",
    "bestFor": [
      "Wydarzenia tymczasowe",
      "Warsztaty",
      "Spotkania społeczności"
    ],
    "playbook": [
      "Wybierz rolkę zapowiadającą lub podsumowującą wydarzenie.",
      "Użyj ZAPIS jako głównego słowa i dodaj warianty dotyczące biletów.",
      "Wyślij jeden link z datą, lokalizacją i potwierdzeniem zapisu.",
      "Wstrzymaj kampanię po zakończeniu wydarzenia."
    ],
    "metrics": [
      "Zapisy",
      "Kliknięcia biletów",
      "Odpowiedzi pod postami wydarzenia"
    ],
    "accent": "emerald"
  },
  {
    "slug": "creator-media-kit",
    "title": "Oferta współpracy dla marek",
    "category": "Biznes twórców",
    "audience": "Twórcy i agencje",
    "summary": "Wysyłaj ofertę współpracy, cennik lub formularz kontaktowy po komentarzu WSPÓŁPRACA, OFERTA lub STAWKI.",
    "goal": "Kampania klienta agencji",
    "keywords": [
      "WSPÓŁPRACA",
      "OFERTA",
      "STAWKI"
    ],
    "dmMessage": "Cześć {username}, oto moja oferta i formularz współpracy: https://example.com/wspolpraca",
    "triggerExample": "WSPÓŁPRACA",
    "privateReplyPreview": "Cześć Piotr, oto moja oferta i formularz współpracy.",
    "setupMinutes": 4,
    "outcome": "Zbieraj zapytania od marek bez odsyłania do szukania linku w bio.",
    "bestFor": [
      "Przypięte portfolio",
      "Studia przypadków",
      "Kontakt z markami"
    ],
    "playbook": [
      "Przypnij post o współpracy lub rolkę z portfolio.",
      "Użyj słów, które marki naturalnie wpisują w komentarzach.",
      "Wyślij link do oferty i jedno pytanie o potrzeby marki.",
      "Co tydzień przeglądaj wiadomości i wybieraj pasujące zapytania."
    ],
    "metrics": [
      "Zapytania marek",
      "Kliknięcia oferty",
      "Rozmowy o współpracy"
    ],
    "accent": "cyan"
  }
];

export function getCampaignTemplate(slug: string | null | undefined) {
  if (!slug) return null;
  return CAMPAIGN_TEMPLATES.find((template) => template.slug === slug) ?? null;
}

export function getCampaignTemplateSlugs() {
  return CAMPAIGN_TEMPLATES.map((template) => template.slug);
}
