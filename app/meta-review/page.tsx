import type { Metadata } from "next";
import LegalShell from "@/components/legal-shell";

export const metadata: Metadata = { title: "Weryfikacja aplikacji Meta — InstaScaler", description: "Opis przepływu odpowiedzi prywatnych dla profesjonalnych kont Instagram." };

export default function MetaReviewPage() {
  return <LegalShell title="Weryfikacja aplikacji Meta" description="Opis przepływu odpowiedzi prywatnych dla profesjonalnych kont Instagram." updatedAt="8 września 2026">
    <section><h2 className="text-xl font-bold text-foreground">Przepływ użytkownika</h2><p className="mt-3">Administrator loguje się loginem i hasłem, łączy profesjonalne konto Instagram przez OAuth i tworzy kampanię dla posta lub rolki. Gdy pojawi się pasujący komentarz, aplikacja weryfikuje podpis zdarzenia, zapisuje je, przekazuje do kolejki i wysyła odpowiedź prywatną z użyciem identyfikatora komentarza.</p></section>
    <section><h2 className="text-xl font-bold text-foreground">Zabezpieczenia</h2><p className="mt-3">InstaScaler korzysta z oficjalnego API Meta, sprawdza podpisy webhooków, szyfruje tokeny i kontroluje limity wysyłania. Identyfikatory zdarzeń oraz rezerwacje dostaw zapobiegają wielokrotnemu przetwarzaniu tego samego zdarzenia.</p></section>
    <section><h2 className="text-xl font-bold text-foreground">Scenariusz testowy</h2><p className="mt-3">Połącz profesjonalne konto testowe, utwórz kampanię ze słowem LINK, a następnie dodaj komentarz z tym słowem z drugiego konta pod wybranym postem. Sprawdź prywatną odpowiedź i pojedynczy zapis dostawy. Jeśli kampania wymaga obserwowania, sprawdź też przycisk potwierdzenia i dostarczenie materiału.</p></section>
  </LegalShell>;
}
