"use client";
import { useState } from "react";
import type { QuizGraph, QuizInput } from "@/lib/quiz/contracts";
import { simulateQuiz } from "@/lib/quiz/engine";
import { validateGraph } from "@/lib/quiz/graph";
import { Field } from "./fields";

export function QuizPreview({ graph }: { graph: QuizGraph }) {
  const [inputs, setInputs] = useState<QuizInput[]>([]);
  const [text, setText] = useState("");
  const issues = validateGraph(graph);
  if (issues.length) return <p className="text-sm text-muted">Uzupełnij błędy grafu, aby uruchomić podgląd rozmowy.</p>;
  const result = simulateQuiz(graph, inputs);
  const question = graph.nodes.find(n => n.id === result.snapshot.nodeId);
  const answer = (input: QuizInput) => { setInputs([...inputs, input]); setText(""); };
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Podgląd rozmowy</h2><button type="button" className="app-button app-button-secondary" onClick={() => { setInputs([]); setText(""); }}>Restart testu</button></div><p className="text-sm leading-relaxed text-muted">Symulacja po kliknięciu „Zaczynamy”. Nie wysyła DM i nie zapisuje kontaktów.</p><div className="max-h-96 space-y-3 overflow-y-auto rounded border border-border bg-background p-4" aria-live="polite">{result.messages.map((m, i) => <div key={i} className="max-w-lg whitespace-pre-wrap break-words rounded border border-border bg-surface p-3 text-sm leading-relaxed">{m.text}{m.material && <p className="mt-2 text-accent-ink">Materiał: {m.material.name}</p>}</div>)}</div>{question?.type === "question" && result.snapshot.phase === "waiting" && <div className="space-y-3">{question.input === "choice" ? <div className="flex flex-wrap gap-2">{question.choices.map(c => <button type="button" key={c.id} className="app-button app-button-primary" onClick={() => answer({ kind: "answer", choiceId: c.id, value: c.value })}>{c.label}</button>)}</div> : <form className="space-y-3" onSubmit={e => { e.preventDefault(); answer({ kind: "answer", value: text }); }}><Field label={question.input === "email" ? "Testowy adres e-mail" : "Testowa odpowiedź"}><input className="app-field" value={text} maxLength={1000} onChange={e => setText(e.target.value)} /></Field><button className="app-button app-button-primary" type="submit">Wyślij odpowiedź testową</button></form>}{!question.required && <button type="button" className="app-button app-button-secondary" onClick={() => answer({ kind: "skip" })}>Pomiń</button>}</div>}<div className="border-t border-border pt-4 text-sm leading-relaxed"><p>Tagi: {result.snapshot.tags.join(", ") || "brak"}</p><p data-testid="preview-qualified">Kwalifikacja: {result.qualification.qualified ? "wartościowy lead" : "jeszcze niespełniona"}</p><p>Powody: {result.qualification.reasons.map(reasonLabel).join(", ") || "brak"}</p><p>Stan: {result.snapshot.phase === "completed" ? "zakończony" : result.snapshot.phase === "human" ? "przekazany administratorowi" : result.snapshot.phase === "stopped" ? "zatrzymany" : "oczekuje na odpowiedź"}</p></div></div>;
}
export function reasonLabel(reason: string) { const [kind, ...rest] = reason.split(":"); return ({ email: "poprawny e-mail", interest: "zainteresowanie pomocą / ofertą", tag: `tag: ${rest.join(":")}`, answer: `odpowiedź: ${rest.join(":")}`, field: `pole: ${rest.join(":")}`, completed: `ukończony krok: ${rest.join(":")}` } as Record<string, string>)[kind] ?? reason; }
