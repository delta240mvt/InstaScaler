import { z } from "zod";
import { safeKey } from "@/lib/quiz/contracts";
const contextSchema = z.object({ runId: safeKey, versionId: safeKey, revision: z.number().int().min(0).max(1000000), nodeId: safeKey, choiceId: z.union([safeKey, z.literal("")]), action: z.enum(["start", "answer", "skip", "continue", "restart", "switch"]) }).strict();
export type QuizButtonContext = z.infer<typeof contextSchema>;
export function encodeQuizPayload(context: QuizButtonContext) { return `quiz1:${JSON.stringify(contextSchema.parse(context))}`; }
export function decodeQuizPayload(raw: string): QuizButtonContext | null {
  if (!raw.startsWith("quiz1:") || raw.length > 1000) return null;
  try { return contextSchema.parse(JSON.parse(raw.slice(6))); } catch { return null; }
}
