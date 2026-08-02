import { constantTimeEqual, decodeBase64url, encodeBase64url, encodeUtf8, hmac } from "@/lib/admin-auth/encoding";

type OAuthState = { v: 1; exp: number; returnTo: string };

export async function createOAuthState(returnTo: string, now: number, signingKey: string): Promise<string> {
  const payload = encodeBase64url(encodeUtf8(JSON.stringify({ v: 1, exp: now + 600, returnTo } satisfies OAuthState)));
  return `${payload}.${encodeBase64url(await hmac(signingKey, payload))}`;
}

export async function verifyOAuthState(value: string, now: number, signingKey: string): Promise<OAuthState | null> {
  const [payload, signature, ...extra] = value.split(".");
  if (!payload || !signature || extra.length) return null;
  const decodedSignature = decodeBase64url(signature);
  const decodedPayload = decodeBase64url(payload);
  if (!decodedSignature || !decodedPayload || !constantTimeEqual(decodedSignature, await hmac(signingKey, payload))) return null;
  try {
    const state = JSON.parse(new TextDecoder().decode(decodedPayload)) as OAuthState;
    return state.v === 1 && Number.isSafeInteger(state.exp) && state.exp > now && typeof state.returnTo === "string" ? state : null;
  } catch { return null; }
}
