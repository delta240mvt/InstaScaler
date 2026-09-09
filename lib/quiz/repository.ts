import type { Prisma } from "@/app/generated/prisma/client";
import type { createPrisma } from "@/lib/db/neon";
import { type Qualification, type QuizMessage, type Snapshot } from "./contracts";

export type QuizDb = ReturnType<typeof createPrisma>;
export type QuizTx = Prisma.TransactionClient;
export const activeStatuses = ["WAITING_START", "ACTIVE", "WAITING_REPLY", "WAITING_WINDOW", "PAUSED", "HUMAN", "UNKNOWN"] as const;
export const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
export const snapshotOf = (value: unknown): Snapshot => value as Snapshot;
export async function lockContact(tx: QuizTx, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "QuizContact" WHERE "id" = ${id} FOR UPDATE`;
}
export async function lockAccount(tx: QuizTx, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "InstagramAccount" WHERE "id" = ${id} FOR UPDATE`;
}
export const runInclude = { contact: true, path: true, version: true } as const;
export type RunRecord = Prisma.QuizRunGetPayload<{ include: typeof runInclude }>;
export type WorkPayload = { message: QuizMessage; opening?: boolean; commentId?: string; sourcePostId?: string; commentCreatedAt?: string; controls?: Array<{ label: string; action: "start" | "continue" | "restart" | "switch"; versionId?: string }> };


export function statusFor(s: Snapshot) {
  return s.phase === "completed" ? "COMPLETED" : s.phase === "human" ? "HUMAN" : s.phase === "stopped" ? "STOPPED" : s.phase === "waiting" ? "WAITING_REPLY" : "ACTIVE";
}
export async function saveSnapshot(tx: QuizTx, run: RunRecord, after: Snapshot, qualification: Qualification, now: Date) {
  const updated = await tx.quizRun.update({ where: { id: run.id }, data: { snapshot: json(after), revision: { increment: 1 }, status: statusFor(after), qualified: qualification.qualified, qualificationReasons: qualification.reasons, qualifiedAt: qualification.qualified ? run.qualifiedAt ?? now : null, finishedAt: ["completed", "stopped"].includes(after.phase) ? now : null } });
  await tx.quizContact.update({ where: { id: run.contactId }, data: { email: after.email, fields: json(after.fields), tags: after.tags } });
  return { ...run, ...updated };
}
export async function createWork(tx: QuizTx, run: Pick<RunRecord, "id" | "revision">, payload: WorkPayload, after?: Snapshot, suffix = "step") {
  const externalId = `quiz-send:${run.id}:${run.revision}:${suffix}`;
  return tx.quizWork.upsert({ where: { externalId }, create: { runId: run.id, externalId, revision: run.revision, payload: json(payload), ...(after ? { afterSnapshot: json(after) } : {}) }, update: {} });
}
