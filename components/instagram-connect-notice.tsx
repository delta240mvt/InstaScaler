"use client";

import { useSearchParams } from "next/navigation";

type Tone = "error" | "warning" | "success";

const TONE_CLASSES: Record<Tone, string> = {
  error: "border-error/20 bg-error/10 text-error",
  warning: "border-warning/20 bg-warning/10 text-warning",
  success: "border-success/20 bg-success/10 text-success",
};

const MESSAGES: Record<string, { tone: Tone; title: string; detail: string }> = {
  denied: {
    tone: "warning",
    title: "Anulowano łączenie z Instagramem",
    detail:
      "Odrzucono prośbę o uprawnienia na Instagramie. Spróbuj ponownie i zaakceptuj wymagane uprawnienia.",
  },
  invalid: {
    tone: "error",
    title: "Łączenie z Instagramem wygasło",
    detail:
      "Link do logowania jest niepełny lub ma więcej niż 10 minut. Naciśnij „Połącz Instagram”, aby spróbować ponownie.",
  },
  forbidden: {
    tone: "error",
    title: "Brak uprawnień",
    detail:
      "Połączenie konta Instagram wymaga zalogowania jako administrator.",
  },
  already_connected: {
    tone: "warning",
    title: "Konto jest już połączone",
    detail:
      "To konto Instagram jest już połączone. Najpierw je odłącz albo wybierz inne konto.",
  },
};

export function InstagramConnectNotice() {
  const searchParams = useSearchParams();
  const status = searchParams.get("instagram");

  if (!status) return null;

  if (status === "misconfigured") {
    const missing = (searchParams.get("missing") ?? "")
      .split(",")
      .filter(Boolean);

    return (
      <Notice tone="error" title="Aplikacja Instagram nie jest skonfigurowana">
        <p>

          Ustaw{" "}
          {missing.length > 0
            ? "te zmienne środowiskowe"
            : "wymagane zmienne środowiskowe"}{" "}

          i uruchom ponownie serwer:
        </p>
        {missing.length > 0 && (
          <ul className="mt-2 space-y-1">
            {missing.map((name) => (
              <li key={name} className="font-mono text-xs">
                {name}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2">

          Zobacz <span className="font-mono text-xs">INSTRUKCJA.md</span>  , aby dowiedzieć się, skąd wziąć wartości. Pamiętaj, że{" "}
          <span className="font-mono text-xs">ENCRYPTION_KEY</span>  musi zawierać 64 znaki szesnastkowe.
        </p>
      </Notice>
    );
  }

  if (status === "failed") {
    const reason = searchParams.get("reason");

    return (
      <Notice tone="error" title="Nie udało się połączyć Instagrama">
        <p>

          Instagram zaakceptował logowanie, ale nie udało się dokończyć połączenia. Sprawdź adres przekierowania i uprawnienia aplikacji.
        </p>
        {reason && (
          <p className="mt-2 font-mono text-xs break-words opacity-80">
            {reason}
          </p>
        )}
      </Notice>
    );
  }

  const known = MESSAGES[status];
  if (!known) return null;

  return (
    <Notice tone={known.tone} title={known.title}>
      <p>{known.detail}</p>
    </Notice>
  );
}

function Notice({
  tone,
  title,
  children,
}: {
  tone: Tone;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" className={`rounded-2xl border p-4 text-sm shadow-sm ${TONE_CLASSES[tone]}`}>
      <p className="font-semibold">{title}</p>
      <div className="mt-1 opacity-90">{children}</div>
    </div>
  );
}
