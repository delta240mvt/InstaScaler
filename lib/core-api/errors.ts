import type { GraphIssue } from "@/lib/quiz/contracts";
const messages: Record<string, string> = {
  quiz_revision_conflict: "Dane zmieniły się w innej karcie lub rozmowie. Zachowano Twoje zmiany. Pobierz aktualną wersję przed ponownym zapisem.",
  quiz_trigger_conflict: "To hasło koliduje z aktywną kampanią lub ścieżką w tym samym kanale (komentarze lub DM). Zmień hasło, zakres postów dla komentarzy albo wyłącz kolidujące wejście.",
  quiz_invalid_graph: "Uzupełnij wskazane kroki i połączenia przed publikacją.",
  quiz_path_not_found: "Nie znaleziono ścieżki.",
  quiz_contact_not_found: "Nie znaleziono kontaktu.",
  quiz_run_not_found: "Nie znaleziono przebiegu rozmowy.",
  quiz_run_blocked: "Ta akcja jest niedostępna w obecnym stanie rozmowy.",
  quiz_send_uncertain: "Wysyłka trwa lub jej wynik jest nieznany. Sprawdź rozmowę przed dalszą obsługą.",
  quiz_not_published: "Najpierw opublikuj poprawną ścieżkę.",
  invalid_credentials: "Nieprawidłowy login lub hasło.",
  unauthorized: "Sesja wygasła. Zaloguj się ponownie.",
  forbidden: "Nie masz uprawnień do tej operacji. Zaloguj się ponownie.",
  invalid_input: "Sprawdź dane formularza i spróbuj ponownie.",
  invalid_message: "Wpisz wiadomość i wybierz odbiorcę.",
  account_not_found: "Nie znaleziono konta Instagram. Połącz je ponownie w ustawieniach.",
  missing_account_id: "Wybierz konto Instagram.",
  account_paused: "Wysyłka dla tego konta jest wstrzymana. Sprawdź połączenie w ustawieniach.",
  rate_limited: "Limit żądań został przekroczony. Spróbuj ponownie za chwilę.",
  too_many_requests: "Limit żądań został przekroczony. Spróbuj ponownie za chwilę.",
  meta_send_failed: "Instagram nie przyjął wiadomości. Sprawdź połączenie konta i dostępność rozmowy.",
  service_unavailable: "Usługa jest chwilowo niedostępna. Spróbuj ponownie później.",
  automation_not_found: "Nie znaleziono kampanii.",
  missing_automation_id: "Wybierz kampanię.",
  report_not_found: "Raport jest niedostępny lub udostępnianie zostało wyłączone.",
  not_found: "Nie znaleziono danych.",
  replay_not_available: "Tego zadania nie można ponowić.",
  token_expired: "Połączenie z Instagramem wygasło. Połącz konto ponownie.",
  reconnect_required: "Połącz konto Instagram ponownie w ustawieniach.",
};

export function getPolishErrorMessage(code: unknown): string {
  return typeof code === "string" && Object.hasOwn(messages, code)
    ? messages[code]
    : "Nie udało się wykonać operacji. Spróbuj ponownie.";
}

export class CoreApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, public readonly requestId?: string, public readonly retryAfterSeconds?: number, public readonly issues?: GraphIssue[]) {
    super(getPolishErrorMessage(code));
    this.name = "CoreApiError";
  }
}
