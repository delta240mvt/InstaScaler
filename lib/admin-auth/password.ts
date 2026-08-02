import { constantTimeEqual, decodeBase64url, encodeBase64url, hmac } from "@/lib/admin-auth/encoding";

export async function verifyAdminPassword(
  password: string,
  pepper: string,
  expectedVerifier: string,
): Promise<boolean> {
  const expected = decodeBase64url(expectedVerifier);
  if (!expected) return false;
  const actual = await hmac(pepper, password);
  return constantTimeEqual(actual, expected);
}

export async function createPasswordVerifier(password: string, pepper: string): Promise<string> {
  return encodeBase64url(await hmac(pepper, password));
}
