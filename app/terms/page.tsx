import type { Metadata } from "next";
import LegalShell from "@/components/legal-shell";

export const metadata: Metadata = { title: "Regulamin — InstaScaler", description: "Zasady korzystania z InstaScaler — aplikacji do kampanii komentarz → wiadomość na Instagramie." };

export default function TermsPage() {
  return <LegalShell title="Regulamin" description="Zasady korzystania z InstaScaler — aplikacji do kampanii komentarz → wiadomość na Instagramie." updatedAt="8 września 2026">
    <section><h2 className="text-xl font-bold text-foreground">Uprawnione korzystanie</h2><p className="mt-3">Z InstaScaler można korzystać wyłącznie w odniesieniu do profesjonalnych kont Instagram, których jesteś właścicielem lub którymi możesz zarządzać. Odpowiadasz za skonfigurowane kampanie, słowa kluczowe, linki i treść wiadomości.</p></section>
    <section><h2 className="text-xl font-bold text-foreground">Zasady platformy</h2><p className="mt-3">Korzystając z aplikacji, przestrzegaj warunków Meta, zasad Instagrama, obowiązujących reguł wysyłania wiadomości oraz przepisów dotyczących prywatności, reklamy i spamu. Aplikacja może ograniczać wysyłkę lub wstrzymywać kampanie w przypadku problemów z uprawnieniami, bezpieczeństwem albo dostarczaniem.</p></section>
    <section><h2 className="text-xl font-bold text-foreground">Dostępność</h2><p className="mt-3">Działanie aplikacji zależy od Meta, Cloudflare i Neon. Ciągła dostępność nie jest gwarantowana. Limity lub awarie dostawców mogą opóźniać przetwarzanie zdarzeń i wysyłanie wiadomości.</p></section>
    <section><h2 className="text-xl font-bold text-foreground">Licencja</h2><p className="mt-3">Publiczne repozytorium InstaScaler jest udostępniane na licencji MIT. Aplikację wdrażasz we własnym środowisku i zarządzasz jej konfiguracją oraz połączonymi kontami.</p></section>
  </LegalShell>;
}
