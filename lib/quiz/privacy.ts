import type { JournalBucket } from "@/lib/events/journal";
import { QuizError } from "./errors";
import { lockContact, type QuizDb } from "./repository";

export async function deleteQuizContact(db: QuizDb, bucket: JournalBucket, id: string) {
  await db.$transaction(async tx => {
    await lockContact(tx, id);
    const contact = await tx.quizContact.findUnique({ where: { id } });
    if (!contact) throw new QuizError("quiz_contact_not_found", 404);
    await tx.quizContact.update({ where: { id }, data: { deletedAt: contact.deletedAt ?? new Date(), instagramUserId: null, username: null, email: null, fields: {}, tags: [], lastInteractionAt: null } });
    await tx.quizRun.updateMany({ where: { contactId: id }, data: { status: "STOPPED", snapshot: {}, qualificationReasons: [], qualified: false, qualifiedAt: null, sourceCommentId: "", sourcePostId: "", lastInteractionAt: null, finishedAt: new Date() } });
    await tx.quizWork.updateMany({ where: { run: { contactId: id } }, data: { status: "CANCELLED", payload: {}, afterSnapshot: {} } });
  });
  // Remove journals before deduplication rows, in bounded batches. Repeating deletion resumes cleanup.
  for (;;) {
    const events = await db.quizEvent.findMany({ where: { run: { contactId: id } }, select: { id: true, externalId: true }, take: 500 });
    if (!events.length) break;
    const ids = events.map(e => e.externalId);
    const journals = await db.processedEvent.findMany({ where: { externalId: { in: ids } }, select: { r2Key: true } });
    for (const e of journals) if (e.r2Key && bucket.delete) await bucket.delete(e.r2Key);
    await db.processedEvent.updateMany({ where: { externalId: { in: ids } }, data: { terminalStatus: "SKIPPED", completedAt: new Date() } });
    await db.quizEvent.deleteMany({ where: { id: { in: events.map(e => e.id) } } });
  }
  for (;;) {
    const work = await db.quizWork.findMany({ where: { run: { contactId: id } }, select: { id: true, r2Key: true }, take: 500 });
    if (!work.length) break;
    for (const w of work) if (w.r2Key && bucket.delete) await bucket.delete(w.r2Key);
    await db.processedEvent.updateMany({ where: { externalId: { in: work.map(w => `quiz-work:${w.id}`) } }, data: { terminalStatus: "SKIPPED", completedAt: new Date() } });
    await db.quizWork.deleteMany({ where: { id: { in: work.map(w => w.id) } } });
  }
  await db.quizRun.deleteMany({ where: { contactId: id } });
}
export async function retainQuizWork(db: QuizDb, bucket: JournalBucket, cutoff: Date) {
  const work = await db.quizWork.findMany({ where: { status: { in: ["SENT", "CANCELLED", "FAILED"] }, updatedAt: { lt: cutoff }, run: { status: { in: ["COMPLETED", "STOPPED", "RESTARTED", "FAILED"] } } }, select: { id: true, r2Key: true }, take: 500, orderBy: { updatedAt: "asc" } });
  for (const w of work) if (w.r2Key && bucket.delete) await bucket.delete(w.r2Key);
  await db.quizWork.deleteMany({ where: { id: { in: work.map(w => w.id) } } });
}
