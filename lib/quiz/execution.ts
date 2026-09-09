import { graphSchema, MAX_QUIZ_NODES, type QuizInput, type Snapshot } from "./contracts";
import { advanceNode, initialSnapshot } from "./engine";
import { qualify } from "./qualification";
import { activeStatuses, createWork, json, lockAccount, lockContact, runInclude, saveSnapshot, snapshotOf, statusFor, type QuizDb, type QuizTx, type RunRecord, type WorkPayload } from "./repository";
import type { QuizButtonContext } from "@/lib/delivery/quiz-payload";
import { canSendQuizMessage } from "@/lib/delivery/quiz-policy";

export async function participantKey(accountId: string, userId: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([accountId, userId])))), b => b.toString(16).padStart(2, "0")).join("");
}
type EntryInput = { accountId: string; instagramUserId: string; username: string | null; pathVersionId: string; externalId: string; occurredAt: Date; receivedAt: Date } & ({ kind?: "COMMENT"; commentId: string; postId: string } | { kind: "MESSAGE"; messageId: string });
async function newRun(tx: QuizTx, input: EntryInput, contactId: string) {
  const version = await tx.quizVersion.findUniqueOrThrow({ where: { id: input.pathVersionId }, include: { path: true } });
  const graph = graphSchema.parse(version.graph);
  const start = graph.nodes.find(n => n.type === "start")!;
  if (start.type !== "start") throw new Error("quiz_invalid_graph");
  const contact = await tx.quizContact.findUniqueOrThrow({ where: { id: contactId } });
  const snapshot: Snapshot = { ...initialSnapshot(graph, { email: contact.email, tags: contact.tags, fields: contact.fields as Snapshot["fields"] }), nodeId: start.id, phase: "waiting", completedNodeIds: [] };
  const source = input.kind === "MESSAGE"
    ? { sourceMessageId: input.messageId, lastInteractionAt: input.occurredAt }
    : { sourceCommentId: input.commentId, sourcePostId: input.postId, commentCreatedAt: input.occurredAt };
  const run = await tx.quizRun.create({ data: { contactId, pathId: version.pathId, versionId: version.id, snapshot: json(snapshot), ...source } });
  if (input.kind === "MESSAGE") await tx.quizContact.update({ where: { id: contactId }, data: { lastInteractionAt: contact.lastInteractionAt && contact.lastInteractionAt > input.occurredAt ? contact.lastInteractionAt : input.occurredAt } });
  await tx.quizEvent.create({ data: { runId: run.id, externalId: input.externalId, nodeId: start.id, kind: "ENTRY" } });
  const work = await createWork(tx, run, { opening: input.kind !== "MESSAGE", ...(input.kind !== "MESSAGE" ? { commentId: input.commentId } : {}), message: { text: start.text, buttons: [] }, controls: [{ label: start.cta, action: "start" }] }, snapshot);
  return { runId: run.id, workId: work.id };
}
export async function createQuizEntry(db: QuizDb, input: EntryInput): Promise<{ runId: string; workId: string } | { blocked: true }> {
  const key = await participantKey(input.accountId, input.instagramUserId);
  return db.$transaction(async tx => {
    // Serializes even the first entry, before a contact row exists.
    await lockAccount(tx, input.accountId);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
    const version = await tx.quizVersion.findUnique({ where: { id: input.pathVersionId }, include: { path: true } });
    if (!version || !version.path.acceptsEntries || version.path.halted || version.path.instagramAccountId !== input.accountId || version.path.publishedVersionId !== version.id) return { blocked: true };
    const start = graphSchema.parse(version.graph).nodes.find(n => n.type === "start");
    if (!start || (start.trigger === "dm") !== (input.kind === "MESSAGE")) return { blocked: true };
    if (input.kind === "MESSAGE" && !canSendQuizMessage({ now: new Date(), lastInteractionAt: input.occurredAt, commentCreatedAt: null, opening: false, blocked: false })) return { blocked: true };
    if (await tx.quizEvent.findUnique({ where: { externalId: input.externalId } })) return { blocked: true };
    let contact = await tx.quizContact.findUnique({ where: { instagramAccountId_participantKey: { instagramAccountId: input.accountId, participantKey: key } } });
    if (contact) {
      await lockContact(tx, contact.id);
      contact = await tx.quizContact.findUniqueOrThrow({ where: { id: contact.id } });
      if (contact.deletedAt && (input.occurredAt <= contact.deletedAt || input.receivedAt <= contact.deletedAt)) return { blocked: true };
      if (contact.deletedAt && await tx.quizRun.count({ where: { contactId: contact.id } })) return { blocked: true };
      if (contact.deletedAt) contact = await tx.quizContact.update({ where: { id: contact.id }, data: { deletedAt: null, instagramUserId: input.instagramUserId, username: input.username } });
    } else contact = await tx.quizContact.create({ data: { instagramAccountId: input.accountId, participantKey: key, instagramUserId: input.instagramUserId, username: input.username } });
    const active = await tx.quizRun.findFirst({ where: { contactId: contact.id, status: { in: [...activeStatuses] } }, include: runInclude });
    if (!active) return newRun(tx, input, contact.id);
    // A DM keyword must never replace or restart an existing conversation, including concurrent entries.
    if (input.kind === "MESSAGE") return { blocked: true };
    if (["PAUSED", "HUMAN", "UNKNOWN"].includes(active.status) || active.path.halted || await tx.quizWork.findFirst({ where: { runId: active.id, status: { in: ["PENDING", "SENDING", "UNKNOWN"] } } })) return { blocked: true };
    await tx.quizEvent.create({ data: { runId: active.id, externalId: input.externalId, kind: "REENTRY", data: json({ versionId: version.id }) } });
    const same = active.pathId === version.pathId;
    const work = await createWork(tx, active, { opening: true, commentId: input.commentId, sourcePostId: input.postId, commentCreatedAt: input.occurredAt.toISOString(), message: { text: same ? "Masz już rozpoczęty quiz. Kontynuujesz czy zaczynasz od nowa?" : "Masz rozpoczęty inny quiz. Chcesz go kontynuować czy przejść do nowej ścieżki?", buttons: [] }, controls: [{ label: "Kontynuuj", action: "continue" }, { label: same ? "Zacznij od nowa" : "Zmień ścieżkę", action: same ? "restart" : "switch", versionId: version.id }] }, undefined, input.commentId);
    return { runId: active.id, workId: work.id };
  });
}

async function interaction(tx: QuizTx, run: RunRecord, occurredAt: Date) {
  const at = run.lastInteractionAt && run.lastInteractionAt > occurredAt ? run.lastInteractionAt : occurredAt;
  await tx.quizRun.update({ where: { id: run.id }, data: { lastInteractionAt: at } });
  await tx.quizContact.update({ where: { id: run.contactId }, data: { lastInteractionAt: at } });
}
export async function acceptQuizInput(db: QuizDb, input: { runId: string; expectedRevision: number; externalId: string; instagramUserId: string; instagramAccountId: string; nodeId: string; input: QuizInput; occurredAt: Date }) {
  return db.$transaction(async tx => {
    const first = await tx.quizRun.findUnique({ where: { id: input.runId }, select: { contactId: true } });
    if (!first) return "blocked";
    await lockContact(tx, first.contactId);
    const run = await tx.quizRun.findUniqueOrThrow({ where: { id: input.runId }, include: runInclude });
    if (run.contact.deletedAt || run.contact.instagramUserId !== input.instagramUserId || run.contact.instagramAccountId !== input.instagramAccountId) return "blocked";
    if (await tx.quizEvent.findUnique({ where: { externalId: input.externalId } })) return "duplicate";
    if (input.input.kind === "stop") {
      if (!(activeStatuses as readonly string[]).includes(run.status)) return "blocked";
      await tx.quizWork.updateMany({ where: { runId: run.id, status: "PENDING" }, data: { status: "CANCELLED" } });
      await tx.quizRun.update({ where: { id: run.id }, data: { status: "STOPPED", revision: { increment: 1 }, finishedAt: new Date(), snapshot: json({ ...snapshotOf(run.snapshot), phase: "stopped" }) } });
      await tx.quizEvent.create({ data: { runId: run.id, externalId: input.externalId, kind: "STOP" } });
      return "accepted";
    }
    if (run.path.halted || ["PAUSED", "HUMAN", "UNKNOWN"].includes(run.status) || !(activeStatuses as readonly string[]).includes(run.status)) return "blocked";
    if (run.revision !== input.expectedRevision || snapshotOf(run.snapshot).nodeId !== input.nodeId) return "stale";
    if (!canSendQuizMessage({ now: new Date(), lastInteractionAt: input.occurredAt, opening: false, blocked: false, commentCreatedAt: null })) return "blocked";
    if (run.status === "WAITING_WINDOW") {
      await interaction(tx, run, input.occurredAt);
      await tx.quizRun.update({ where: { id: run.id }, data: { status: snapshotOf(run.snapshot).phase === "waiting" ? "WAITING_REPLY" : "ACTIVE" } });
      if (await tx.quizWork.findFirst({ where: { runId: run.id, status: "PENDING" } })) {
        await tx.quizEvent.create({ data: { runId: run.id, externalId: input.externalId, kind: "WINDOW_REOPENED" } });
        return "accepted";
      }
    }
    if (await tx.quizWork.findFirst({ where: { runId: run.id, status: { in: ["PENDING", "SENDING", "UNKNOWN"] } } })) return "blocked";
    const graph = graphSchema.parse(run.version.graph);
    const transition = advanceNode(graph, snapshotOf(run.snapshot), input.input);
    await interaction(tx, run, input.occurredAt);
    await tx.quizEvent.create({ data: { runId: run.id, externalId: input.externalId, nodeId: input.nodeId, kind: transition.error ? "INVALID_ANSWER" : "ANSWER", data: json(transition.error ? { code: transition.error } : input.input.kind === "skip" ? { skipped: true } : { value: transition.after.answers[input.nodeId] }) } });
    if (transition.error) {
      await createWork(tx, run, { message: { text: transition.error === "INVALID_EMAIL" ? "Wpisz poprawny adres e-mail. Możesz też użyć przycisku Pomiń, jeśli jest dostępny." : "Odpowiedz na aktualne pytanie, korzystając z dostępnych przycisków lub wpisując odpowiedź.", buttons: [] } }, undefined, input.externalId.replace(/[^a-zA-Z0-9_-]/g, "").slice(-80));
    } else await saveSnapshot(tx, run, transition.after, qualify(graph.qualification, transition.after), new Date());
    return "accepted";
  });
}
export async function reconcileQuizButton(db: QuizDb, context: QuizButtonContext, accountId: string, userId: string) {
  return db.$transaction(async tx => {
    const first = await tx.quizRun.findUnique({ where: { id: context.runId }, select: { contactId: true } });
    if (!first) return false;
    await lockContact(tx, first.contactId);
    const run = await tx.quizRun.findUniqueOrThrow({ where: { id: context.runId }, include: runInclude });
    if (run.contact.deletedAt || run.contact.instagramAccountId !== accountId || run.contact.instagramUserId !== userId || run.path.halted || !["ACTIVE", "WAITING_START", "WAITING_REPLY", "WAITING_WINDOW", "UNKNOWN"].includes(run.status)) return false;
    const work = await tx.quizWork.findFirst({ where: { runId: run.id, status: { in: ["SENDING", "UNKNOWN"] }, revision: { in: [context.revision, context.revision - 1] } } });
    if (!work || work.revision !== run.revision) return false;
    const p = work.payload as WorkPayload;
    const after = snapshotOf(work.afterSnapshot ?? run.snapshot);
    if (after.nodeId !== context.nodeId || context.revision !== work.revision + (work.afterSnapshot ? 1 : 0)) return false;
    const authorized = p.controls
      ? p.controls.some(c => c.action === context.action && (c.versionId ?? run.versionId) === context.versionId)
      : context.versionId === run.versionId && p.message.buttons.some(b => b.kind === context.action && (b.kind !== "answer" || b.id === context.choiceId));
    if (!authorized) return false;
    await tx.quizWork.update({ where: { id: work.id }, data: { status: "SENT" } });
    if (work.afterSnapshot) await saveSnapshot(tx, run, after, qualify(graphSchema.parse(run.version.graph).qualification, after), new Date());
    const opening = graphSchema.parse(run.version.graph).nodes.find(n => n.id === after.nodeId)?.type === "start";
    await tx.quizRun.update({ where: { id: run.id }, data: { status: opening ? "WAITING_START" : statusFor(after) } });
    await tx.quizEvent.upsert({ where: { externalId: `quiz-sent:${work.id}` }, create: { runId: run.id, externalId: `quiz-sent:${work.id}`, nodeId: snapshotOf(run.snapshot).nodeId, kind: "MESSAGE_SENT", data: { confirmedByButton: true } }, update: {} });
    return true;
  });
}
export async function acceptQuizControl(db: QuizDb, context: QuizButtonContext, externalId: string, accountId: string, userId: string, occurredAt: Date) {
  return db.$transaction(async tx => {
    const first = await tx.quizRun.findUnique({ where: { id: context.runId }, select: { contactId: true } });
    if (!first) return null;
    await lockContact(tx, first.contactId);
    const run = await tx.quizRun.findUniqueOrThrow({ where: { id: context.runId }, include: runInclude });
    if (run.contact.deletedAt || run.contact.instagramUserId !== userId || run.contact.instagramAccountId !== accountId || run.path.halted || !(activeStatuses as readonly string[]).includes(run.status) || ["PAUSED", "HUMAN"].includes(run.status)) return null;
    if (await tx.quizEvent.findUnique({ where: { externalId } })) return null;
    if (run.status === "UNKNOWN") return null;
    if (run.revision !== context.revision || snapshotOf(run.snapshot).nodeId !== context.nodeId) return null;
    const sent = await tx.quizWork.findMany({ where: { runId: run.id, status: "SENT", revision: { in: [run.revision, run.revision - 1] } }, take: 20, orderBy: { createdAt: "desc" } });
    const authorized = sent.find(w => {
      const p = w.payload as { controls?: Array<{ action: string; versionId?: string }> };
      return p.controls?.some(c => c.action === context.action && (c.versionId ?? run.versionId) === context.versionId);
    });
    if (!authorized) return null;
    await interaction(tx, run, occurredAt);
    if (context.action === "start" || context.action === "continue") {
      let snapshot = snapshotOf(run.snapshot);
      if (run.status === "WAITING_START") snapshot = initialSnapshot(graphSchema.parse(run.version.graph), snapshot);
      else if (snapshot.phase === "waiting") snapshot = { ...snapshot, phase: "ready" }; // Resend the current prompt with a new revision.
      await tx.quizRun.update({ where: { id: run.id }, data: { snapshot: json(snapshot), status: "ACTIVE", revision: { increment: 1 } } });
      await tx.quizEvent.create({ data: { runId: run.id, externalId, kind: context.action.toUpperCase() } });
      return run.id;
    }
    const version = await tx.quizVersion.findUnique({ where: { id: context.versionId }, include: { path: true } });
    if (!version || version.path.instagramAccountId !== accountId || !version.path.acceptsEntries || version.path.halted || version.path.publishedVersionId !== version.id) return null;
    await tx.quizWork.updateMany({ where: { runId: run.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    await tx.quizRun.update({ where: { id: run.id }, data: { status: "RESTARTED", finishedAt: new Date(), revision: { increment: 1 } } });
    const snapshot = initialSnapshot(graphSchema.parse(version.graph), snapshotOf(run.snapshot));
    const source = authorized.payload as WorkPayload;
    const next = await tx.quizRun.create({ data: { contactId: run.contactId, pathId: version.pathId, versionId: version.id, status: "ACTIVE", snapshot: json(snapshot), sourceCommentId: source.commentId ?? run.sourceCommentId, sourcePostId: source.sourcePostId ?? run.sourcePostId, sourceMessageId: source.commentId ? null : run.sourceMessageId, commentCreatedAt: source.commentCreatedAt ? new Date(source.commentCreatedAt) : run.commentCreatedAt, lastInteractionAt: occurredAt } });
    await tx.quizEvent.create({ data: { runId: next.id, externalId, kind: context.action.toUpperCase() } });
    return next.id;
  });
}
export async function advanceQuizRun(db: QuizDb, runId: string, expectedRevision?: number, now = new Date()): Promise<{ workId: string | null; state: string }> {
  return db.$transaction(async tx => {
    const first = await tx.quizRun.findUnique({ where: { id: runId }, select: { contactId: true } });
    if (!first) return { workId: null, state: "missing" };
    await lockContact(tx, first.contactId);
    let run = await tx.quizRun.findUnique({ where: { id: runId }, include: runInclude });
    if (!run) return { workId: null, state: "missing" };
    const pending = await tx.quizWork.findFirst({ where: { runId, status: { in: ["PENDING", "SENDING", "UNKNOWN"] } }, orderBy: { createdAt: "asc" } });
    if (pending) return { workId: pending.status === "PENDING" ? pending.id : null, state: pending.status === "PENDING" ? "send" : "blocked" };
    if (run.status !== "ACTIVE" || run.path.halted || run.contact.deletedAt || (expectedRevision !== undefined && run.revision !== expectedRevision)) return { workId: null, state: run.status };
    const graph = graphSchema.parse(run.version.graph);
    // One contact lock and transaction for bounded local steps; sending remains outside it.
    for (let i = 0; i < MAX_QUIZ_NODES; i++) {
      const current = snapshotOf(run.snapshot);
      if (current.phase !== "ready") return { workId: null, state: current.phase };
      const externalId = `quiz-advance:${run.id}:${run.revision}`;
      if (await tx.quizEvent.findUnique({ where: { externalId } })) return { workId: null, state: "duplicate" };
      const transition = advanceNode(graph, current);
      await tx.quizEvent.create({ data: { runId, externalId, nodeId: current.nodeId, kind: transition.outbound ? "PREPARED" : "TRANSITION" } });
      if (transition.outbound) {
        const work = await createWork(tx, run, { message: transition.outbound }, transition.after);
        return { workId: work.id, state: "send" };
      }
      run = await saveSnapshot(tx, run, transition.after, qualify(graph.qualification, transition.after), now);
    }
    return { workId: null, state: "complete" };
  });
}
