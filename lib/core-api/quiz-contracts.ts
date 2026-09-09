import type { QuizDraft, Snapshot, Value } from "@/lib/quiz/contracts";
export type PathDetail = { id: string; name: string; instagramAccountId: string; draft: QuizDraft; draftRevision: number; publishedVersionId: string | null; acceptsEntries: boolean; halted: boolean; createdAt: string; updatedAt: string; metrics: { started: number; completed: number; qualified: number } };
export type ContactSummary = { id: string; instagramAccountId: string; instagramUserId: string | null; username: string | null; email: string | null; tags: string[]; updatedAt: string; qualified: boolean };
export type ContactDetail = ContactSummary & { fields: Record<string, Value>; lastInteractionAt: string | null };
export type RunSummary = { id: string; pathId: string; pathName: string; version: number; status: string; snapshot: Snapshot; sourcePostId: string | null; sourceMessageId: string | null; qualified: boolean; qualificationReasons: string[]; lastInteractionAt: string | null; createdAt: string };
export type QuizEventSummary = { id: string; nodeId: string | null; kind: string; data: Record<string, unknown>; createdAt: string };
export type ContactPatch = { expectedUpdatedAt: string; email: string | null; fields: Record<string, Value>; tags: string[] };
