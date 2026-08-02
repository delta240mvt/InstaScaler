"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createCoreApi } from "@/lib/core-api/client";
import { CoreApiError } from "@/lib/core-api/errors";
import { safeCallbackUrl } from "@/lib/admin-auth/callback-url";
import { Icon } from "@/components/ui-icons";

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
  const [showPassword, setShowPassword] = useState(false);

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
      <div className="space-y-1.5">
        <label htmlFor="login" className="app-label">Login</label>
        <input
          id="login"
          name="login"
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          autoComplete="username"
          required
          placeholder="Administrator login"
          className="app-field"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="app-label">Password</label>
        <div className="relative">
          <input id="password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required placeholder="Your password" className="app-field pr-12" />
          <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-1 top-1/2 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-foreground">
            <Icon name="eye" size={18} className={showPassword ? "hidden" : "block"} />
            <Icon name="eyeOff" size={18} className={showPassword ? "block" : "hidden"} />
          </button>
        </div>
      </div>
      {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-error/15 bg-error/6 px-3 py-2.5 text-sm text-error"><Icon name="alert" size={16} className="mt-0.5 shrink-0" />{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="app-button app-button-primary w-full"
      >
        {submitting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />Signing in...</> : <>Sign in<Icon name="arrowRight" size={17} /></>}
      </button>
    </form>
  );
}
