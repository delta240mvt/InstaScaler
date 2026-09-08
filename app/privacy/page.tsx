import type { Metadata } from "next";
import LegalShell from "@/components/legal-shell";

export const metadata: Metadata = { title: "Polityka prywatności — InstaScaler", description: "Jak InstaScaler przetwarza dane kont Instagram, kampanii i wiadomości." };

export default function PrivacyPage() {
  return <LegalShell title="Polityka prywatności" description="Jak InstaScaler przetwarza dane kont Instagram, kampanii i wiadomości." updatedAt="8 września 2026">
    <section><h2 className="text-xl font-bold text-foreground">Administrator danych</h2><p className="mt-3">Administratorem danych InstaScaler jest Przemysław Filipiak. Pytania o prywatność, dostęp do danych lub ich usunięcie można przesyłać na adres delta240mvt@gmail.com.</p></section>
    <section><h2 className="text-xl font-bold text-foreground">Przetwarzane dane</h2><p className="mt-3">Aplikacja przetwarza identyfikatory połączonych kont Instagram, zaszyfrowane tokeny dostępu, ustawienia kampanii, zdarzenia webhook, komentarze i wiadomości niezbędne do obsługi kampanii, historię dostaw, statystyki kliknięć oraz dane diagnostyczne. Logowanie administratora korzysta z loginu i weryfikatora hasła; hasło nie jest przechowywane.</p></section>
    <section><h2 className="text-xl font-bold text-foreground">Cel przetwarzania</h2><p className="mt-3">Dane służą do uwierzytelniania administratora, łączenia kont Instagram, dopasowywania kampanii, wysyłania odpowiedzi przez oficjalne API Meta, zapobiegania duplikatom, analizy wyników i diagnozowania błędów.</p></section>
    <section><h2 className="text-xl font-bold text-foreground">Dane Instagram i Meta</h2><p className="mt-3">InstaScaler nie wymaga hasła do Instagrama, nie pobiera danych przez scraping i nie automatyzuje przeglądarki Instagrama. Tokeny są szyfrowane w bazie i wykorzystywane do czynności autoryzowanych dla połączonego konta.</p></section>
    <section><h2 className="text-xl font-bold text-foreground">Infrastruktura</h2><p className="mt-3">Aplikacja korzysta z Cloudflare Workers, R2, Queues, Durable Objects i Workflows oraz bazy Neon Postgres. Komunikacja z Instagramem odbywa się przez oficjalne API Meta. Dostawcy infrastruktury przetwarzają dane potrzebne do działania aplikacji.</p></section>
    <section><h2 className="text-xl font-bold text-foreground">Przechowywanie i usuwanie</h2><p className="mt-3">Administrator może odłączyć konto Instagram w ustawieniach. Zatrzymuje to kampanie powiązane z kontem i usuwa zapisane połączenie. Żądania dotyczące usunięcia danych należy zgłaszać zgodnie z instrukcją na stronie „Usuwanie danych”.</p></section>
    <section><h2 className="text-xl font-bold text-foreground">Kontakt</h2><p className="mt-3">W sprawach prywatności skontaktuj się z Przemysławem Filipiakiem: delta240mvt@gmail.com.</p></section>
  </LegalShell>;
}
