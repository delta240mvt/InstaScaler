import { z } from "zod";
import type { Prisma, QuizContact } from "@/app/generated/prisma/client";
import { QuizRunStatus } from "@/app/generated/prisma/enums";
import { emailSchema, graphSchema, profileFields, profileTags } from "./contracts";
import { pageQuery } from "./paths";
import { activeStatuses, json, lockContact, runInclude, snapshotOf, type QuizDb } from "./repository";
import { qualify } from "./qualification";
import { QuizError } from "./errors";
import type { ContactDetail, ContactPatch, ContactSummary, QuizEventSummary, RunSummary } from "@/lib/core-api/quiz-contracts";

const flag = z.enum(["true", "false"]).transform(v => v === "true").optional();
export const contactQuery = pageQuery.extend({ instagramAccountId: z.string().max(80).optional(), instagramUserId: z.string().regex(/^\d+$/).optional(), pathId: z.string().max(80).optional(), tag: z.string().max(80).optional(), hasEmail: flag, interested: flag, qualified: flag, status: z.enum(QuizRunStatus).optional(), search: z.string().max(120).optional() });
export function contactWhere(query: z.infer<typeof contactQuery>): Prisma.QuizContactWhereInput {
  const run: Prisma.QuizRunWhereInput = { ...(query.pathId ? { pathId: query.pathId } : {}), ...(query.qualified === true ? { qualified: true } : {}), ...(query.interested !== undefined ? { snapshot: { path: ["interest"], equals: query.interested } } : {}), ...(query.status ? { status: query.status } : {}) };
  const runs = { ...(Object.keys(run).length ? { some: run } : {}), ...(query.qualified === false ? { none: { ...run, qualified: true } } : {}) };
  return { deletedAt: null, ...(query.instagramAccountId && query.instagramAccountId !== "all" ? { instagramAccountId: query.instagramAccountId } : {}), ...(query.instagramUserId ? { instagramUserId: query.instagramUserId } : {}), ...(query.tag ? { tags: { has: query.tag } } : {}), ...(query.hasEmail !== undefined ? { email: query.hasEmail ? { not: null } : null } : {}), ...(Object.keys(runs).length ? { runs } : {}), ...(query.search ? { OR: [{ username: { contains: query.search, mode: "insensitive" } }, { email: { contains: query.search, mode: "insensitive" } }] } : {}) };
}
function summary(c: QuizContact, qualified: boolean): ContactSummary { return { id: c.id, instagramAccountId: c.instagramAccountId, instagramUserId: c.instagramUserId, username: c.username, email: c.email, tags: c.tags, updatedAt: c.updatedAt.toISOString(), qualified }; }
export async function listQuizContacts(db: QuizDb, raw: Record<string, string>) {
  const query = contactQuery.parse(raw);
  const where = contactWhere(query);
  const [rows, total] = await Promise.all([db.quizContact.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: { runs: { where: { qualified: true }, select: { id: true }, take: 1 } } }), db.quizContact.count({ where })]);
  return { items: rows.map(c => summary(c, c.runs.length > 0)), total, page: query.page, pageSize: query.pageSize };
}
export async function getQuizContact(db: QuizDb, id: string): Promise<ContactDetail> {
  const c = await db.quizContact.findFirst({ where: { id, deletedAt: null }, include: { runs: { where: { qualified: true }, select: { id: true }, take: 1 } } });
  if (!c) throw new QuizError("quiz_contact_not_found", 404);
  return { ...summary(c, c.runs.length > 0), fields: profileFields.parse(c.fields), lastInteractionAt: c.lastInteractionAt?.toISOString() ?? null };
}
export async function listContactRuns(db: QuizDb, id: string, raw: Record<string, string>) {
  await getQuizContact(db, id);
  const { page, pageSize } = pageQuery.parse(raw);
  const where = { contactId: id };
  const [rows, total] = await Promise.all([db.quizRun.findMany({ where, include: { path: { select: { name: true } }, version: { select: { number: true } } }, orderBy: { createdAt: "desc" }, take: pageSize, skip: (page - 1) * pageSize }), db.quizRun.count({ where })]);
  const items: RunSummary[] = rows.map(r => ({ id: r.id, pathId: r.pathId, pathName: r.path.name, version: r.version.number, status: r.status, snapshot: snapshotOf(r.snapshot), sourcePostId: r.sourcePostId, sourceMessageId: r.sourceMessageId, qualified: r.qualified, qualificationReasons: r.qualificationReasons, lastInteractionAt: r.lastInteractionAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() }));
  return { items, total, page, pageSize };
}
export async function listRunEvents(db: QuizDb, runId: string, raw: Record<string, string>) {
  if (!await db.quizRun.findFirst({ where: { id: runId, contact: { deletedAt: null } }, select: { id: true } })) throw new QuizError("quiz_run_not_found", 404);
  const { page, pageSize } = pageQuery.parse(raw);
  const [rows, total] = await Promise.all([db.quizEvent.findMany({ where: { runId }, orderBy: { createdAt: "desc" }, take: pageSize, skip: (page - 1) * pageSize }), db.quizEvent.count({ where: { runId } })]);
  const items: QuizEventSummary[] = rows.map(e => ({ id: e.id, nodeId: e.nodeId, kind: e.kind, data: e.data as Record<string, unknown>, createdAt: e.createdAt.toISOString() }));
  return { items, total, page, pageSize };
}
export const contactPatchSchema = z.object({ expectedUpdatedAt: z.iso.datetime(), email: emailSchema.nullable(), fields: profileFields, tags: profileTags }).strict();
export async function updateQuizContact(db: QuizDb, id: string, raw: ContactPatch) {
  const patch = contactPatchSchema.parse(raw);
  await db.$transaction(async tx => {
    await lockContact(tx, id);
    const c = await tx.quizContact.findUnique({ where: { id } });
    if (!c || c.deletedAt) throw new QuizError("quiz_contact_not_found", 404);
    if (c.updatedAt.toISOString() !== patch.expectedUpdatedAt) throw new QuizError("quiz_revision_conflict", 409);
    if (await tx.quizWork.findFirst({ where: { run: { contactId: id }, status: { in: ["SENDING", "UNKNOWN"] } } })) throw new QuizError("quiz_send_uncertain", 409);
    await tx.quizContact.update({ where: { id }, data: { email: patch.email, tags: patch.tags, fields: json(patch.fields) } });
    const run = await tx.quizRun.findFirst({ where: { contactId: id, status: { in: [...activeStatuses] } }, include: runInclude });
    if (run) {
      // Preserve delivery revision: profile corrections must not invalidate already-delivered buttons.
      const snapshot = { ...snapshotOf(run.snapshot), email: patch.email, tags: patch.tags, fields: patch.fields };
      const result = qualify(graphSchema.parse(run.version.graph).qualification, snapshot);
      await tx.quizRun.update({ where: { id: run.id }, data: { snapshot: json(snapshot), qualified: result.qualified, qualificationReasons: result.reasons, qualifiedAt: result.qualified ? run.qualifiedAt ?? new Date() : null } });
      const work = await tx.quizWork.findMany({ where: { runId: run.id, status: { in: ["PENDING", "SENDING", "UNKNOWN"] } }, take: 10 });
      for (const w of work) if (w.afterSnapshot) await tx.quizWork.update({ where: { id: w.id }, data: { afterSnapshot: json({ ...snapshotOf(w.afterSnapshot), email: patch.email, tags: patch.tags, fields: patch.fields }) } });
      await tx.quizEvent.create({ data: { runId: run.id, externalId: `quiz-profile:${crypto.randomUUID()}`, kind: "PROFILE_UPDATED" } });
    }
  });
  return getQuizContact(db, id);
}
