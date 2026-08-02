export class AccountLimitError extends Error {
  code = "ACCOUNT_LIMIT_REACHED" as const;
}

export type AccountDb = { instagramAccount: { count(args?: unknown): Promise<number>; upsert(args: unknown): Promise<unknown>; findMany(args?: unknown): Promise<unknown[]>; delete(args: unknown): Promise<unknown> } };

export async function connectInstagramAccount(db: AccountDb, input: { instagramId: string; username: string; name?: string | null; accessToken: string; tokenExpiresAt?: Date | null; webhookSubscribed?: boolean }) {
  const existingCount = await db.instagramAccount.count();
  if (existingCount >= 5) throw new AccountLimitError("Up to five Instagram accounts are allowed");
  return db.instagramAccount.upsert({ where: { instagramId: input.instagramId }, create: input, update: input });
}

export function listInstagramAccounts(db: AccountDb) {
  return db.instagramAccount.findMany({ orderBy: { connectedAt: "desc" }, select: { id: true, instagramId: true, username: true, name: true, webhookSubscribed: true, tokenExpiresAt: true } });
}

export function disconnectInstagramAccount(db: AccountDb, id: string) {
  return db.instagramAccount.delete({ where: { id } });
}
