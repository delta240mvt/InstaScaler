import { graphSchema, type QuizTrigger } from "./contracts";
import { QuizError } from "./errors";
import type { QuizTx } from "./repository";

type Trigger = { trigger?: QuizTrigger; allPosts: boolean; postIds: string[]; keyword: string };
type OtherTrigger = { trigger?: QuizTrigger; allPosts: boolean; postIds: string[]; keywords: string[]; matchAnyWord: boolean };
export function triggersOverlap(a: Trigger, b: OtherTrigger) {
  if ((a.trigger ?? "comment") !== (b.trigger ?? "comment")) return false;
  const posts = a.trigger === "dm" || a.allPosts || b.allPosts || a.postIds.some(p => b.postIds.includes(p));
  const keyword = a.keyword.toLocaleLowerCase("pl").trim();
  return posts && (b.matchAnyWord || b.keywords.some(k => { const other = k.toLocaleLowerCase("pl").trim(); return keyword.includes(other) || other.includes(keyword); }));
}
export async function assertNoQuizConflict(tx: QuizTx, accountId: string, candidate: OtherTrigger, excludePathId?: string) {
  const paths = await tx.quizPath.findMany({ where: { instagramAccountId: accountId, acceptsEntries: true, ...(excludePathId ? { id: { not: excludePathId } } : {}) }, include: { publishedVersion: true }, take: 501 });
  if (paths.length > 500) throw new QuizError("quiz_trigger_conflict", 409);
  for (const path of paths) {
    if (!path.publishedVersion) continue;
    const start = graphSchema.parse(path.publishedVersion.graph).nodes.find(n => n.type === "start");
    if (start?.type === "start" && triggersOverlap(start, candidate)) throw new QuizError("quiz_trigger_conflict", 409);
  }
}
export async function assertPublishConflicts(tx: QuizTx, accountId: string, start: Trigger, pathId: string) {
  await assertNoQuizConflict(tx, accountId, { trigger: start.trigger, allPosts: start.allPosts, postIds: start.postIds, keywords: [start.keyword], matchAnyWord: false }, pathId);
  const campaigns = await tx.automation.findMany({ where: { instagramAccountId: accountId, isActive: true, ...(start.trigger === "dm" ? { dmTriggerEnabled: true } : {}) }, select: { matchAnyPost: true, postId: true, keywords: true, matchAnyWord: true, pendingNextReel: true }, take: 501 });
  if (campaigns.length > 500 || campaigns.some(c => triggersOverlap(start, { trigger: start.trigger, allPosts: c.matchAnyPost || c.pendingNextReel, postIds: c.postId ? [c.postId] : [], keywords: c.keywords, matchAnyWord: c.matchAnyWord }))) throw new QuizError("quiz_trigger_conflict", 409);
}
