import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import {
  loginErrorMessage,
  validateAdminCredentials,
} from "@/components/admin-login-form";
import { safeCallbackUrl } from "@/lib/admin-auth/callback-url";
import { protectWebRoute as proxy } from "@/lib/web-route-protection";

describe("admin login UI contract", () => {
  it("validates both credentials", () => {
    expect(validateAdminCredentials("", "secret")).toBe("Wpisz login i hasło.");
    expect(validateAdminCredentials("admin", "")).toBe("Wpisz login i hasło.");
    expect(validateAdminCredentials("admin", "secret")).toBeNull();
  });

  it("maps invalid and throttled login errors", () => {
    expect(loginErrorMessage(401)).toBe("Nieprawidłowy login lub hasło.");
    expect(loginErrorMessage(429, 125)).toBe("Zbyt wiele prób. Spróbuj ponownie za 3 min.");
  });

  it("accepts only local callback paths", () => {
    expect(safeCallbackUrl("/campaigns/new?template=welcome")).toBe("/campaigns/new?template=welcome");
    expect(safeCallbackUrl("https://evil.example/steal")).toBe("/dashboard");
    expect(safeCallbackUrl("//evil.example/steal")).toBe("/dashboard");
    expect(safeCallbackUrl("dashboard")).toBe("/dashboard");
  });

  it("keeps login reachable when callbackUrl is a repeated query or malformed value", () => {
    for (const value of [["/campaigns", "/settings"], [], {}, 42]) {
      expect(safeCallbackUrl(value)).toBe("/dashboard");
    }
  });
});

describe("web route protection", () => {
  it("allows login with an expired or invalid cookie instead of redirecting in a loop", () => {
    const request = new NextRequest("https://app.example/login", { headers: { cookie: "__Host-instascaler-session=expired" } });
    expect(proxy(request).headers.get("x-middleware-next")).toBe("1");
  });
  it.each(["/dashboard", "/overview", "/campaigns/new", "/automations", "/inbox", "/logs", "/diagnostics", "/settings", "/paths", "/paths/demo", "/paths/contacts", "/paths/contacts/demo"])(
    "redirects unauthenticated requests for %s",
    (path) => {
      const response = proxy(new NextRequest(`https://app.example${path}`));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(`https://app.example/login?callbackUrl=${encodeURIComponent(path)}`);
    },
  );

  it("uses only the host-only admin session cookie", () => {
    const legacy = new NextRequest("https://app.example/dashboard", {
      headers: { cookie: "authjs.session-token=legacy" },
    });
    expect(proxy(legacy).status).toBe(307);

    const current = new NextRequest("https://app.example/dashboard", {
      headers: { cookie: "__Host-instascaler-session=signed" },
    });
    expect(proxy(current).headers.get("x-middleware-next")).toBe("1");
  });
});
