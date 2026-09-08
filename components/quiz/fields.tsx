"use client";
import { useState, type ReactNode } from "react";
import type { Value } from "@/lib/quiz/contracts";
import { createCoreApi } from "@/lib/core-api/client";

export const quizApi = createCoreApi({ baseUrl: "" });
export const errorText = (e: unknown) => e instanceof Error ? e.message : "Nie udało się wykonać operacji.";
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-2 text-sm font-medium leading-relaxed">{label}{children}</label>; }
export function ListInput({ value, onChange, maxLength = 4000 }: { value: string[]; onChange(v: string[]): void; maxLength?: number }) {
  const [text, setText] = useState(value.join(", "));
  return <input className="app-field" value={text} maxLength={maxLength} onChange={e => { setText(e.target.value); onChange(e.target.value.split(",").map(v => v.trim()).filter(Boolean)); }} />;
}
export function ValueInput({ value, onChange, label = "Wartość" }: { value: Value; onChange(v: Value): void; label?: string }) {
  const type = value === null ? "null" : typeof value;
  return <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2"><select className="app-field" aria-label={`${label}: typ`} value={type} onChange={e => onChange(e.target.value === "null" ? null : e.target.value === "number" ? 0 : e.target.value === "boolean" ? false : "")}><option value="string">Tekst</option><option value="number">Liczba</option><option value="boolean">Tak / nie</option><option value="null">Brak</option></select>{type === "boolean" ? <select className="app-field" aria-label={label} value={String(value)} onChange={e => onChange(e.target.value === "true")}><option value="true">Tak</option><option value="false">Nie</option></select> : type !== "null" ? <input className="app-field" aria-label={label} type={type === "number" ? "number" : "text"} value={String(value)} maxLength={1000} onChange={e => onChange(type === "number" ? Number(e.target.value) : e.target.value)} /> : <span className="self-center text-muted">Puste</span>}</div>;
}
export function FieldsForm({ value, onChange }: { value: Record<string, Value>; onChange(v: Record<string, Value>): void }) {
  return <div className="space-y-3">{Object.entries(value).map(([key, val], i) => <div key={i} className="space-y-2 border-l-2 border-accent pl-3"><Field label={`Nazwa pola ${i + 1}`}><input className="app-field" value={key} maxLength={80} onChange={e => { const entries = Object.entries(value); entries[i] = [e.target.value, val]; onChange(Object.fromEntries(entries)); }} /></Field><ValueInput label={`Wartość pola ${i + 1}`} value={val} onChange={v => onChange({ ...value, [key]: v })} /><button type="button" className="text-sm text-error underline" onClick={() => onChange(Object.fromEntries(Object.entries(value).filter(([k]) => k !== key)))}>Usuń pole {i + 1}</button></div>)}<button type="button" className="app-button app-button-secondary" disabled={Object.keys(value).length >= 50} onClick={() => { let n = 1; while (Object.hasOwn(value, `pole${n}`)) n++; onChange({ ...value, [`pole${n}`]: "" }); }}>Dodaj pole</button></div>;
}
