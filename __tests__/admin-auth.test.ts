import { describe, expect, it } from "vitest";
import { SESSION_COOKIE, serializeSessionCookie } from "@/lib/admin-auth/cookies";
import { verifyAdminPassword } from "@/lib/admin-auth/password";
import { createSessionToken, verifySessionToken } from "@/lib/admin-auth/session";

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function verifier(password: string, pepper: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(password)),
    ),
  );
}

describe("single-admin authentication primitives", () => {
  it("accepts exactly the configured password verifier", async () => {
    const expected = await verifier("correct horse", "pepper");
    await expect(verifyAdminPassword("correct horse", "pepper", expected)).resolves.toBe(true);
    await expect(verifyAdminPassword("wrong", "pepper", expected)).resolves.toBe(false);
    await expect(verifyAdminPassword("correct horse", "pepper", "not-valid***")).resolves.toBe(false);
  });

  it("signs a seven-day session and rejects tampering or expiry", async () => {
    const now = 1_800_000_000;
    const token = await createSessionToken(now, 604_800, "signing-key");

    await expect(verifySessionToken(token, now + 1, "signing-key")).resolves.toEqual({ exp: now + 604_800 });
    await expect(verifySessionToken(`${token}x`, now + 1, "signing-key")).resolves.toBeNull();
    await expect(verifySessionToken(token, now + 604_801, "signing-key")).resolves.toBeNull();
    await expect(verifySessionToken("bad.token", now, "signing-key")).resolves.toBeNull();
  });

  it("serializes a fixed host-only secure cookie", () => {
    expect(SESSION_COOKIE).toBe("__Host-instascaler-session");
    expect(serializeSessionCookie("token")).toBe(
      "__Host-instascaler-session=token; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800",
    );
  });
});
