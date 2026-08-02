import { describe, expect, it } from "vitest";
import { createOAuthState, verifyOAuthState } from "@/lib/core/meta-oauth";
import { connectInstagramAccount } from "@/lib/core/instagram-accounts";

describe("single-owner Instagram accounts", () => {
  it("limits the owner to five connected accounts", async () => {
    const db = { instagramAccount: { count: async () => 5, upsert: async () => null } };
    await expect(connectInstagramAccount(db, { instagramId: "1", username: "one", accessToken: "token" })).rejects.toMatchObject({ code: "ACCOUNT_LIMIT_REACHED" });
  });

  it("signs and verifies OAuth state", async () => {
    const state = await createOAuthState("https://app.example/settings", 1_800_000_000, "key");
    await expect(verifyOAuthState(state, 1_800_000_001, "key")).resolves.toMatchObject({ returnTo: "https://app.example/settings" });
    await expect(verifyOAuthState(`${state}x`, 1_800_000_001, "key")).resolves.toBeNull();
  });
});
