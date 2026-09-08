import { Suspense } from "react";
import { QuizContactsList } from "@/components/quiz/contacts-list";
export default function ContactsPage() { return <Suspense fallback={<p>Wczytywanie kontaktów…</p>}><QuizContactsList /></Suspense>; }
