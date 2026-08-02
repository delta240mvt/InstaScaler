import { constantTimeEqual, decodeBase64url, encodeBase64url, encodeUtf8, hmac } from "@/lib/admin-auth/encoding";

type OAuthState = { v: 1; exp: number; returnTo: string };

export function buildAuthorizationUrl(input: { appId: string; redirectUri: string; state: string }): string {
  const url = new URL("https://api.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", ["instagram_business_basic", "instagram_business_manage_messages", "instagram_business_manage_comments", "instagram_business_manage_insights"].join(","));
  return url.toString();
}

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

async function encryptionKey(encodedKey: string): Promise<CryptoKey> {
  const bytes = decodeBase64url(encodedKey);
  if (!bytes || bytes.byteLength !== 32) throw new Error("ENCRYPTION_KEY must contain 32 base64url-encoded bytes");
  return crypto.subtle.importKey("raw", bytes as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptToken(token: string, encodedKey: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(encodedKey), encodeUtf8(token) as BufferSource);
  return `v1.${encodeBase64url(iv)}.${encodeBase64url(new Uint8Array(ciphertext))}`;
}

export async function decryptToken(value: string, encodedKey: string): Promise<string> {
  const [version, encodedIv, encodedCiphertext, ...extra] = value.split(".");
  const iv = encodedIv && decodeBase64url(encodedIv);
  const ciphertext = encodedCiphertext && decodeBase64url(encodedCiphertext);
  if (version !== "v1" || extra.length || !iv || iv.byteLength !== 12 || !ciphertext) throw new Error("Invalid encrypted token");
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as Uint8Array<ArrayBuffer> }, await encryptionKey(encodedKey), ciphertext as BufferSource);
  return new TextDecoder().decode(plaintext);
}
