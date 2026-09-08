import type { Metadata } from "next";
import LegalShell from "@/components/legal-shell";

export const metadata: Metadata = { title: "Usuwanie danych — InstaScaler", description: "Jak odłączyć konto Instagram i zgłosić żądanie usunięcia danych." };

export default function DataDeletionPage() {
  return <LegalShell title="Usuwanie danych" description="Jak odłączyć konto Instagram i zgłosić żądanie usunięcia danych." updatedAt="8 września 2026">
    <section><h2 className="text-xl font-bold text-foreground">Odłączenie Instagrama</h2><p className="mt-3">Zaloguj się, otwórz „Ustawienia” i wybierz „Odłącz” przy odpowiednim koncie. Aplikacja usuwa zapisane połączenie i jego token oraz zatrzymuje wysyłanie wiadomości przez kampanie tego konta.</p></section>
    <section><h2 className="text-xl font-bold text-foreground">Usunięcie danych</h2><p className="mt-3">Aby zgłosić usunięcie danych kampanii, historii dostaw, zapisanych zdarzeń lub diagnostyki, napisz na delta240mvt@gmail.com. Podaj nazwę połączonego konta Instagram oraz zakres żądania. Nie przesyłaj haseł ani tokenów dostępu.</p></section>
    <section><h2 className="text-xl font-bold text-foreground">Weryfikacja żądania</h2><p className="mt-3">Przed usunięciem danych możemy poprosić o potwierdzenie uprawnienia do zarządzania kontem. Żądania są realizowane możliwie szybko, z uwzględnieniem obowiązków dotyczących przechowywania danych oraz bezpieczeństwa.</p></section>
  </LegalShell>;
}
