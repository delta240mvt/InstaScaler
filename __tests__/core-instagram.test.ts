import { describe, expect, it, vi } from "vitest";
import { buildAuthorizationUrl, createOAuthState, decryptToken, encryptToken, verifyOAuthState } from "@/lib/core/meta-oauth";
import { connectInstagramAccount } from "@/lib/core/instagram-accounts";
import { exchangeInstagramCode } from "@/lib/core/meta-client";
import { instagramRoutes } from "@/workers/core/routes/instagram";

describe("single-owner Instagram accounts", () => {
  it("limits the owner to five connected accounts", async () => {
    const models = { instagramAccount: { findUnique: async () => null, count: async () => 5, upsert: async () => null } };
    const db = { $transaction: async (callback: (tx: typeof models) => Promise<unknown>) => callback(models) };
    await expect(connectInstagramAccount(db, { instagramId: "1", username: "one", accessToken: "token" })).rejects.toMatchObject({ code: "ACCOUNT_LIMIT_REACHED" });
  });

  it("checks the account limit and writes inside one transaction", async () => {
    const upsert = vi.fn(async () => ({ id: "account" }));
    const models = { instagramAccount: { findUnique: async () => null, count: async () => 4, upsert } };
    const transaction = vi.fn(async (callback: (tx: typeof models) => Promise<unknown>) => callback(models));
    await expect(connectInstagramAccount({ $transaction: transaction }, { instagramId: "1", username: "one", accessToken: "token" })).resolves.toEqual({ id: "account" });
    expect(transaction).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledOnce();
  });

  it("allows reconnecting an existing account when five are already stored", async () => {
    const upsert = vi.fn(async () => ({ id: "existing" }));
    const models = { instagramAccount: { findUnique: async () => ({ id: "existing" }), count: async () => 5, upsert } };
    const db = { $transaction: async (callback: (tx: typeof models) => Promise<unknown>) => callback(models) };
    await expect(connectInstagramAccount(db, { instagramId: "1", username: "one", accessToken: "new-token" })).resolves.toEqual({ id: "existing" });
  });

  it("signs and verifies OAuth state", async () => {
    const state = await createOAuthState("https://app.example/settings", 1_800_000_000, "key");
    await expect(verifyOAuthState(state, 1_800_000_001, "key")).resolves.toMatchObject({ returnTo: "https://app.example/settings" });
    await expect(verifyOAuthState(`${state}x`, 1_800_000_001, "key")).resolves.toBeNull();
  });

  it("builds an Instagram business authorization URL", () => {
    const url = new URL(buildAuthorizationUrl({ appId: "app", redirectUri: "https://app.example/api/instagram/callback", state: "signed" }));
    expect(url.origin).toBe("https://api.instagram.com");
    expect(url.searchParams.get("client_id")).toBe("app");
    expect(url.searchParams.get("state")).toBe("signed");
    expect(url.searchParams.get("scope")).toContain("instagram_business_manage_messages");
  });

  it("encrypts access tokens with authenticated encryption", async () => {
    const key = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const encrypted = await encryptToken("meta-access-token", key);
    expect(encrypted).not.toContain("meta-access-token");
    await expect(decryptToken(encrypted, key)).resolves.toBe("meta-access-token");
    await expect(decryptToken(`${encrypted}x`, key)).rejects.toThrow();
  });

  it("exchanges OAuth code without putting the app secret in a URL", async () => {
    const request = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ access_token: "short", user_id: 123 }), { headers: { "content-type": "application/json" } }));
    await expect(exchangeInstagramCode({ code: "code", appId: "app", appSecret: "secret", redirectUri: "https://app.example/callback", fetch: request })).resolves.toEqual({ accessToken: "short", userId: "123" });
    const [url, init] = request.mock.calls[0];
    expect(String(url)).not.toContain("secret");
    expect(init?.body).toContain("client_secret=secret");
  });

  it("mounts the complete Instagram account surface", () => {
    const routes = instagramRoutes(() => ({}) as never).routes.map((route) => `${route.method} ${route.path}`);
    expect(routes).toEqual(expect.arrayContaining([
      "GET /instagram/connect",
      "GET /instagram/callback",
      "GET /instagram/accounts",
      "DELETE /instagram/disconnect",
      "GET /instagram/profile",
      "GET /instagram/posts",
      "GET /instagram/overview",
      "GET /instagram/conversations",
      "GET /instagram/conversations/:id",
    ]));
  });
});
