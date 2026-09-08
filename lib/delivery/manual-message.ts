import { z } from "zod";
import type { JobsEnv } from "@/lib/cloudflare/env";
import { decryptToken } from "@/lib/core/meta-oauth";
import { RateLimitError, sendDirectMessage, TokenExpiredError } from "@/lib/meta/client";
import { pauseQuizForManualMessage } from "@/lib/quiz/recovery";
import type { QuizDb } from "@/lib/quiz/repository";

export type ManualMessageInput = { instagramAccountId: string; recipientId: string; text: string };
export type ManualMessageResult = { ok: true; data: { message_id: string } }
  | { ok: false; status: 400 | 404 | 409 | 429 | 502 | 503; error: string };
type ManualMessageDb = { instagramAccount: { findUnique(args: unknown): Promise<{ instagramId: string; accessToken: string; requiresReconnect: boolean; webhookSubscribed: boolean } | null>; update(args: unknown): Promise<unknown> } };
const messageSchema = z.object({ instagramAccountId: z.string().min(1), recipientId: z.string().regex(/^\d+$/), text: z.string().trim().min(1).max(1000) });

export async function sendManualMessage(db: ManualMessageDb, env: JobsEnv, input: ManualMessageInput): Promise<ManualMessageResult> {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: "invalid_message" };
  let account;
  let token;
  try {
    account = await db.instagramAccount.findUnique({ where: { id: parsed.data.instagramAccountId }, select: { instagramId: true, accessToken: true, requiresReconnect: true, webhookSubscribed: true } });
    if (!account) return { ok: false, status: 404, error: "account_not_found" };
    if (account.requiresReconnect || !account.webhookSubscribed) return { ok: false, status: 409, error: "account_paused" };
    if ("quizContact" in db) await pauseQuizForManualMessage(db as QuizDb, parsed.data.instagramAccountId, parsed.data.recipientId);
    token = await decryptToken(account.accessToken, env.ENCRYPTION_KEY);
    const limiter = env.ACCOUNT_RATE_LIMITER.get(env.ACCOUNT_RATE_LIMITER.idFromName(account.instagramId));
    if (!(await limiter.reserve({ amount: 1, now: Date.now() })).allowed) return { ok: false, status: 429, error: "rate_limited" };
  } catch { return { ok: false, status: 503, error: "service_unavailable" }; }
  try {
    const data = await sendDirectMessage(token, account.instagramId, parsed.data.recipientId, parsed.data.text);
    return { ok: true, data: { message_id: data.message_id } };
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      try {
        await db.instagramAccount.update({ where: { id: parsed.data.instagramAccountId }, data: { requiresReconnect: true, webhookSubscribed: false, lastErrorCode: "META_TOKEN_EXPIRED" } });
      } catch { return { ok: false, status: 503, error: "service_unavailable" }; }
      return { ok: false, status: 409, error: "account_paused" };
    }
    return error instanceof RateLimitError
      ? { ok: false, status: 429, error: "rate_limited" }
      : { ok: false, status: 502, error: "meta_send_failed" };
  }
}
