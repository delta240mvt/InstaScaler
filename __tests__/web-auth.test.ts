import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import {
  loginErrorMessage,
  safeCallbackUrl,
  validateAdminCredentials,
} from "@/components/admin-login-form";
import { protectWebRoute as proxy } from "@/lib/web-route-protection";

describe("admin login UI contract", () => {
  it("validates both credentials", () => {
    expect(validateAdminCredentials("", "secret")).toBe("Enter login and password.");
    expect(validateAdminCredentials("admin", "")).toBe("Enter login and password.");
    expect(validateAdminCredentials("admin", "secret")).toBeNull();
  });

  it("maps invalid and throttled login errors", () => {
    expect(loginErrorMessage(401)).toBe("Invalid login or password.");
    expect(loginErrorMessage(429, 125)).toBe("Too many attempts. Try again in 3 minutes.");
  });

  it("accepts only local callback paths", () => {
    expect(safeCallbackUrl("/campaigns/new?template=welcome")).toBe("/campaigns/new?template=welcome");
    expect(safeCallbackUrl("https://evil.example/steal")).toBe("/dashboard");
    expect(safeCallbackUrl("//evil.example/steal")).toBe("/dashboard");
    expect(safeCallbackUrl("dashboard")).toBe("/dashboard");
  });
});

describe("web route protection", () => {
  it.each(["/dashboard", "/overview", "/campaigns/new", "/automations", "/inbox", "/logs", "/diagnostics", "/settings"])(
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
