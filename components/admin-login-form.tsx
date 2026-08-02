"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createCoreApi } from "@/lib/core-api/client";
import { CoreApiError } from "@/lib/core-api/errors";

export function safeCallbackUrl(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export function validateAdminCredentials(login: string, password: string): string | null {
  return login.trim() && password ? null : "Enter login and password.";
}

export function loginErrorMessage(status: number, retryAfterSeconds = 900): string {
  if (status === 401) return "Invalid login or password.";
  if (status === 429) {
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    return `Too many attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
  }
  return "Could not sign in. Try again.";
}

export default function AdminLoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateAdminCredentials(login, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createCoreApi({ baseUrl: "" }).auth.login({ login: login.trim(), password });
      router.replace(safeCallbackUrl(callbackUrl));
      router.refresh();
    } catch (caught) {
      setError(loginErrorMessage(caught instanceof CoreApiError ? caught.status : 500));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <label htmlFor="login" className="block text-sm font-medium text-foreground">Login</label>
        <input
          id="login"
          name="login"
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          autoComplete="username"
          required
          className="w-full rounded border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent/40"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-foreground">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          className="w-full rounded border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent/40"
        />
      </div>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center rounded bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
