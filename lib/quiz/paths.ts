import { z } from "zod";
import type { QuizPath } from "@/app/generated/prisma/client";
import type { PathDetail } from "@/lib/core-api/quiz-contracts";
import { graphSchema, parseQuizDraft, type QuizDraft } from "./contracts";
import { validateGraph } from "./graph";
import { QuizError } from "./errors";
import { json, lockAccount, type QuizDb } from "./repository";
import { assertPublishConflicts } from "./trigger-conflicts";

export const pageQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) });
async function detail(db: QuizDb, p: QuizPath): Promise<PathDetail> {
  const [started, completed, qualified] = await Promise.all([db.quizRun.count({ where: { pathId: p.id } }), db.quizRun.count({ where: { pathId: p.id, status: "COMPLETED" } }), db.quizRun.count({ where: { pathId: p.id, qualified: true } })]);
  return { ...p, draft: { name: p.name, instagramAccountId: p.instagramAccountId, graph: graphSchema.parse(p.draft) }, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(), metrics: { started, completed, qualified } };
}
export async function getPath(db: QuizDb, id: string) {
  const path = await db.quizPath.findUnique({ where: { id } });
  if (!path) throw new QuizError("quiz_path_not_found", 404);
  return detail(db, path);
}
export async function listPaths(db: QuizDb, query: Record<string, string>) {
  const { page, pageSize } = pageQuery.parse(query);
  const where = query.instagramAccountId && query.instagramAccountId !== "all" ? { instagramAccountId: query.instagramAccountId } : {};
  const [rows, total] = await Promise.all([db.quizPath.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }), db.quizPath.count({ where })]);
  return { items: await Promise.all(rows.map(p => detail(db, p))), total, page, pageSize };
}
export async function createPath(db: QuizDb, input: QuizDraft) {
  const draft = parseQuizDraft(input);
  if (!await db.instagramAccount.findUnique({ where: { id: draft.instagramAccountId }, select: { id: true } })) throw new QuizError("account_not_found", 404);
  return detail(db, await db.quizPath.create({ data: { instagramAccountId: draft.instagramAccountId, name: draft.name, draft: json(draft.graph) } }));
}
export async function saveDraft(db: QuizDb, id: string, expectedRevision: number, input: QuizDraft) {
  const draft = parseQuizDraft(input);
  const changed = await db.quizPath.updateMany({ where: { id, draftRevision: expectedRevision, instagramAccountId: draft.instagramAccountId }, data: { name: draft.name, draft: json(draft.graph), draftRevision: { increment: 1 } } });
  if (!changed.count) throw new QuizError("quiz_revision_conflict", 409);
  return getPath(db, id);
}
export async function publishPath(db: QuizDb, id: string, expectedRevision: number) {
  await db.$transaction(async tx => {
    const first = await tx.quizPath.findUnique({ where: { id } });
    if (!first) throw new QuizError("quiz_path_not_found", 404);
    await lockAccount(tx, first.instagramAccountId);
    await tx.$queryRaw`SELECT "id" FROM "QuizPath" WHERE "id" = ${id} FOR UPDATE`;
    const p = await tx.quizPath.findUniqueOrThrow({ where: { id } });
    if (p.draftRevision !== expectedRevision) throw new QuizError("quiz_revision_conflict", 409);
    const graph = graphSchema.parse(p.draft);
    const issues = validateGraph(graph);
    if (issues.length) throw new QuizError("quiz_invalid_graph", 400, issues);
    const start = graph.nodes.find(n => n.type === "start")!;
    if (start.type !== "start") throw new QuizError("quiz_invalid_graph");
    await assertPublishConflicts(tx, p.instagramAccountId, start, id);
    const previous = await tx.quizVersion.findFirst({ where: { pathId: id }, orderBy: { number: "desc" } });
    const v = await tx.quizVersion.create({ data: { pathId: id, number: (previous?.number ?? 0) + 1, graph: json(graph) } });
    await tx.quizPath.update({ where: { id }, data: { publishedVersionId: v.id, acceptsEntries: true } });
  });
  return getPath(db, id);
}
export async function setPathState(db: QuizDb, id: string, acceptsEntries: boolean, halted: boolean) {
  await db.$transaction(async tx => {
    const first = await tx.quizPath.findUnique({ where: { id } });
    if (!first) throw new QuizError("quiz_path_not_found", 404);
    await lockAccount(tx, first.instagramAccountId);
    const p = await tx.quizPath.findUniqueOrThrow({ where: { id }, include: { publishedVersion: true } });
    if (acceptsEntries) {
      if (!p.publishedVersion) throw new QuizError("quiz_not_published", 409);
      const start = graphSchema.parse(p.publishedVersion.graph).nodes.find(n => n.type === "start")!;
      if (start.type !== "start") throw new QuizError("quiz_invalid_graph");
      await assertPublishConflicts(tx, p.instagramAccountId, start, id);
    }
    await tx.quizPath.update({ where: { id }, data: { acceptsEntries, halted } });
  });
  return getPath(db, id);
}
export async function duplicatePath(db: QuizDb, id: string) {
  const p = await getPath(db, id);
  return createPath(db, { ...p.draft, name: `${p.name.slice(0, 112)} (kopia)` });
}
