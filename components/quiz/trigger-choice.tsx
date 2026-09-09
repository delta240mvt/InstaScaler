"use client";
import { useId } from "react";
import type { QuizTrigger } from "@/lib/quiz/contracts";

export function QuizTriggerChoice({ value, onChange }: { value: QuizTrigger; onChange(value: QuizTrigger): void }) {
  const name = useId();
  return <fieldset className="min-w-0 space-y-3">
    <legend className="text-sm font-semibold">Co uruchamia ścieżkę?</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      {([
        ["comment", "Komentarz pod postem", "Odbiorca wpisuje hasło w komentarzu pod wybranym postem."],
        ["dm", "Słowo w DM", "Odbiorca wysyła hasło w prywatnej wiadomości na Instagramie."],
      ] as const).map(([trigger, label, description]) => <label key={trigger} className={`flex min-w-0 cursor-pointer items-start gap-3 border p-4 focus-within:ring-2 focus-within:ring-accent ${value === trigger ? "border-foreground bg-surface-subtle" : "border-border"}`}>
        <input className="mt-1 shrink-0" type="radio" name={name} value={trigger} checked={value === trigger} onChange={() => onChange(trigger)} />
        <span><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs leading-relaxed text-muted">{description}</span></span>
      </label>)}
    </div>
  </fieldset>;
}
