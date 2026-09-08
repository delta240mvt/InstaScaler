import type { QuizGraph } from "./contracts";

export function createDemoGraph(): QuizGraph {
  return { schemaVersion: 1, qualification: { mode: "any", rules: [{ kind: "email" }, { kind: "interest" }] }, nodes: [
    { id: "start", label: "Komentarz START", x: 40, y: 40, type: "start", keyword: "START", postIds: [], allPosts: true, text: "Chcesz przejść krótki quiz? Kliknij Zaczynamy. Możesz zakończyć rozmowę, pisząc STOP.", cta: "Zaczynamy", next: "wybor" },
    { id: "wybor", label: "Potrzeba", x: 40, y: 220, type: "question", text: "Co Cię interesuje? To przykładowy quiz do samodzielnej edycji.", input: "choice", field: "potrzeba", required: true, next: "", choices: [{ id: "material", label: "Darmowy materiał", value: "material", next: "tag-material" }, { id: "pomoc", label: "Twoja pomoc", value: "pomoc", next: "tag-pomoc" }] },
    { id: "tag-material", label: "Tag: materiał", x: 40, y: 400, type: "action", addTags: ["material"], removeTags: [], setFields: {}, next: "email" },
    { id: "tag-pomoc", label: "Zainteresowanie pomocą", x: 340, y: 400, type: "action", addTags: ["pomoc"], removeTags: [], setFields: {}, interest: true, next: "email" },
    { id: "email", label: "Opcjonalny e-mail", x: 40, y: 580, type: "question", text: "Jeśli chcesz, zostaw adres e-mail do kontaktu. Możesz pominąć ten krok. To nie jest zapis na newsletter.", input: "email", field: "email", required: false, choices: [], next: "podziekowanie" },
    { id: "podziekowanie", label: "Podziękowanie", x: 40, y: 760, type: "message", text: "Dziękuję za odpowiedzi!", next: "koniec" },
    { id: "koniec", label: "Koniec", x: 40, y: 940, type: "end", outcome: "completed" },
  ] };
}
