import { describe, expect, it, vi } from "vitest";
import { createPasswordVerifier } from "@/lib/admin-auth/password";
import { LoginThrottle } from "@/workers/core/login-throttle";
import { createCoreApp } from "@/workers/core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function throttleState() {
  const values = new Map<string, unknown>();
  return {
    storage: {
      get: vi.fn(async (key: string) => values.get(key)),
      put: vi.fn(async (key: string, value: unknown) => void values.set(key, value)),
    },
  };
}

describe("Core admin authentication", () => {
  it("uses a Cloudflare Durable Object class for production login throttling", () => {
    const source = readFileSync(resolve("workers/core/login-throttle.ts"), "utf8");
    expect(source).toContain('import { DurableObject } from "cloudflare:workers"');
    expect(source).toContain("class LoginThrottle extends DurableObject");
  });

  it("allows five failures, rejects the sixth, and clears failures after success", async () => {
    const state = throttleState();
    const throttle = new LoginThrottle(state as never, {} as never);

    for (let index = 0; index < 5; index += 1) {
      await expect(throttle.checkAndRecord(false)).resolves.toMatchObject({ allowed: true });
    }
    await expect(throttle.checkAndRecord(false)).resolves.toMatchObject({ allowed: false });
    await expect(throttle.checkAndRecord(true)).resolves.toMatchObject({ allowed: true });
    await expect(throttle.checkAndRecord(false)).resolves.toMatchObject({ allowed: true });
  });

  it("requires a valid session and rejects a cross-origin mutation", async () => {
    const verifier = await createPasswordVerifier("password", "pepper");
    const checkAndRecord = vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 }));
    const app = createCoreApp();
    const env = {
      ADMIN_LOGIN: "admin",
      ADMIN_PASSWORD_PEPPER: "pepper",
      ADMIN_PASSWORD_VERIFIER: verifier,
      SESSION_SIGNING_KEY: "signing-key",
      META_APP_SECRET: "meta",
      META_WEBHOOK_VERIFY_TOKEN: "verify",
      LOGIN_THROTTLE: { idFromName: () => "ip", get: () => ({ checkAndRecord }) },
      INSTAGRAM_JOBS: { send: async () => undefined },
      DATABASE_URL: "postgresql://unused",
    };

    const missing = await app.request("https://app.example/api/auth/session", {}, env);
    expect(missing.status).toBe(401);

    const login = await app.request(
      "https://app.example/api/auth/login",
      { method: "POST", headers: { "content-type": "application/json", origin: "https://app.example" }, body: JSON.stringify({ login: "admin", password: "password" }) },
      env,
    );
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie");
    expect(cookie).toContain("__Host-instascaler-session=");

    const valid = await app.request("https://app.example/api/auth/session", { headers: { cookie: cookie ?? "" } }, env);
    expect(valid.status).toBe(200);
    const noOrigin = await app.request("https://app.example/api/auth/logout", { method: "POST", headers: { cookie: cookie ?? "" } }, env);
    expect(noOrigin.status).toBe(403);
    const forbidden = await app.request("https://app.example/api/auth/logout", { method: "POST", headers: { cookie: cookie ?? "", origin: "https://other.example" } }, env);
    expect(forbidden.status).toBe(403);
  });
});
