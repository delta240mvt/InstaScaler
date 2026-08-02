export type ApiData<T> = { data: T };
export type AdminSession = { admin: true };
export type InstagramAccountSummary = { id: string; instagramId: string; username: string; name: string | null; webhookSubscribed?: boolean };
export type AutomationContract = Record<string, unknown> & { id: string; instagramAccountId: string; name: string; requireFollowBeforeFreebie: boolean };
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
