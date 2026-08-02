export class AccountLimitError extends Error {
  code = "ACCOUNT_LIMIT_REACHED" as const;
}

export type AccountDb = { instagramAccount: { count(args?: unknown): Promise<number>; upsert(args: unknown): Promise<unknown>; findMany(args?: unknown): Promise<unknown[]>; findFirst(args?: unknown): Promise<unknown | null>; findUnique(args: unknown): Promise<unknown | null>; delete(args: unknown): Promise<unknown> } };

type AccountConnectionModels = {
  instagramAccount: {
    findUnique(args: unknown): Promise<unknown | null>;
    count(args?: unknown): Promise<number>;
    upsert(args: unknown): Promise<unknown>;
  };
};

export type AccountConnectionDb = {
  $transaction(callback: (transaction: AccountConnectionModels) => Promise<unknown>): Promise<unknown>;
};

export async function connectInstagramAccount(db: AccountConnectionDb, input: { instagramId: string; username: string; name?: string | null; accessToken: string; tokenExpiresAt?: Date | null; webhookSubscribed?: boolean }) {
  return db.$transaction(async (transaction) => {
    const existing = await transaction.instagramAccount.findUnique({ where: { instagramId: input.instagramId }, select: { id: true } });
    if (!existing && await transaction.instagramAccount.count() >= 5) throw new AccountLimitError("Up to five Instagram accounts are allowed");
    const data = { ...input, requiresReconnect: false, lastErrorCode: null };
    return transaction.instagramAccount.upsert({ where: { instagramId: input.instagramId }, create: data, update: data });
  });
}

export function listInstagramAccounts(db: AccountDb) {
  return db.instagramAccount.findMany({ orderBy: { connectedAt: "desc" }, select: { id: true, instagramId: true, username: true, name: true, webhookSubscribed: true, requiresReconnect: true, lastErrorCode: true, tokenExpiresAt: true } });
}

export function disconnectInstagramAccount(db: AccountDb, id: string) {
  return db.instagramAccount.delete({ where: { id } });
}
