"use client";

/**
 * Keyword Input
 *
 * Tag-style input for adding/removing keywords.
 */

import { useState, type KeyboardEvent } from "react";

interface KeywordInputProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  max?: number;
}

export default function KeywordInput({ keywords, onChange, max = 10 }: KeywordInputProps) {
  const [input, setInput] = useState("");

  function addKeyword(value: string) {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return;
    if (keywords.includes(trimmed)) return;
    if (keywords.length >= max) return;
    onChange([...keywords, trimmed]);
    setInput("");
  }

  function removeKeyword(keyword: string) {
    onChange(keywords.filter((k) => k !== keyword));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword(input);
    }
    if (e.key === "Backspace" && !input && keywords.length > 0) {
      removeKeyword(keywords[keywords.length - 1]);
    }
  }

  return (
    <div className="space-y-2">
      <div className="app-field flex min-h-14 flex-wrap gap-2 p-2.5">
        {keywords.map((keyword) => (
          <span
            key={keyword}
            className="inline-flex items-center gap-2 rounded-lg border border-accent/20 bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent"
          >
            {keyword}
            <button
              type="button"
              onClick={() => removeKeyword(keyword)}
              aria-label={`Remove ${keyword}`}
              className="min-h-8 text-muted hover:text-error"
            >
              Remove
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={keywords.length === 0 ? "Type keyword and press Enter..." : ""}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-foreground placeholder:text-zinc-500 outline-none"
        />
      </div>
      <p className="text-xs text-muted">
        {keywords.length}/{max} keywords · Press Enter or comma to add
      </p>
    </div>
  );
}
