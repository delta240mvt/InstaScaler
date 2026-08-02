import { constantTimeEqual, decodeBase64url, encodeBase64url, encodeUtf8, hmac } from "@/lib/admin-auth/encoding";

type SessionPayload = { v: 1; exp: number };

export async function createSessionToken(now: number, ttlSeconds: number, signingKey: string): Promise<string> {
  const payload: SessionPayload = { v: 1, exp: now + ttlSeconds };
  const encodedPayload = encodeBase64url(encodeUtf8(JSON.stringify(payload)));
  return `${encodedPayload}.${encodeBase64url(await hmac(signingKey, encodedPayload))}`;
}

export async function verifySessionToken(token: string, now: number, signingKey: string): Promise<{ exp: number } | null> {
  const [encodedPayload, encodedSignature, ...extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra.length > 0) return null;
  const signature = decodeBase64url(encodedSignature);
  if (!signature || !constantTimeEqual(await hmac(signingKey, encodedPayload), signature)) return null;
  const payloadBytes = decodeBase64url(encodedPayload);
  if (!payloadBytes) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as Partial<SessionPayload>;
    const exp = payload.exp;
    if (payload.v !== 1 || typeof exp !== "number" || !Number.isSafeInteger(exp) || exp <= now) return null;
    return { exp };
  } catch {
    return null;
  }
}
