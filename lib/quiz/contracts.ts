import { z } from "zod";

export const MAX_QUIZ_NODES = 10;
const quizTriggerSchema = z.enum(["comment", "dm"]);
export type QuizTrigger = z.infer<typeof quizTriggerSchema>;
export const safeKey = z.string().min(1).max(80).regex(/^[\p{L}\p{N}_-]+$/u).refine(v => !["__proto__", "prototype", "constructor"].includes(v));
const target = z.union([safeKey, z.literal("")]);
const value = z.union([z.string().max(1000), z.number().finite(), z.boolean(), z.null()]);
export const profileFields = z.record(safeKey, value).refine(v => Object.keys(v).length <= 50);
export const profileTags = z.array(z.string().trim().min(1).max(80)).max(50);
export const emailSchema = z.email().max(254);
const criterion = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("email") }).strict(),
  z.object({ kind: z.literal("interest") }).strict(),
  z.object({ kind: z.literal("tag"), value: z.string().min(1).max(80) }).strict(),
  z.object({ kind: z.literal("answer"), nodeId: safeKey, value }).strict(),
  z.object({ kind: z.literal("field"), key: safeKey, value }).strict(),
  z.object({ kind: z.literal("completed"), nodeId: safeKey }).strict(),
]);
export const ruleGroupSchema = z.object({ mode: z.enum(["any", "all"]), rules: z.array(criterion).max(10) }).strict();
const base = { id: safeKey, label: z.string().max(100), x: z.number().min(0).max(5000), y: z.number().min(0).max(5000) };
const https = z.string().max(2048).refine(v => { try { const u = new URL(v); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; } });
export const nodeSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("start"), trigger: quizTriggerSchema.default("comment"), keyword: z.string().trim().max(80), postIds: z.array(z.string().regex(/^\d+$/)).max(100), allPosts: z.boolean(), text: z.string().max(640), cta: z.string().max(20), next: target }).strict(),
  z.object({ ...base, type: z.literal("message"), text: z.string().max(1000), material: z.object({ name: z.string().min(1).max(20), url: https }).strict().optional(), next: target }).strict().refine(n => !n.material || n.text.length <= 640),
  z.object({ ...base, type: z.literal("question"), text: z.string().max(640), input: z.enum(["choice", "text", "email"]), field: target, required: z.boolean(), next: target, choices: z.array(z.object({ id: safeKey, label: z.string().max(20), value: z.string().max(1000), next: target }).strict()).max(3) }).strict().refine(n => n.choices.length + (n.required ? 0 : 1) <= 3),
  z.object({ ...base, type: z.literal("condition"), when: ruleGroupSchema, yes: target, no: target }).strict(),
  z.object({ ...base, type: z.literal("action"), addTags: profileTags, removeTags: profileTags, setFields: profileFields, interest: z.boolean().optional(), next: target }).strict(),
  z.object({ ...base, type: z.literal("end"), outcome: z.enum(["completed", "human"]) }).strict(),
]);
export const graphSchema = z.object({ schemaVersion: z.literal(1), nodes: z.array(nodeSchema).max(MAX_QUIZ_NODES), qualification: ruleGroupSchema }).strict();
export const draftSchema = z.object({ name: z.string().trim().min(1).max(120), instagramAccountId: safeKey, graph: graphSchema }).strict();
export function parseQuizDraft(input: unknown): QuizDraft {
  if (new TextEncoder().encode(JSON.stringify(input)).length > 65536) throw new Error("quiz_draft_too_large");
  return draftSchema.parse(input);
}
export type Value = z.infer<typeof value>;
export type Criterion = z.infer<typeof criterion>;
export type RuleGroup = z.infer<typeof ruleGroupSchema>;
export type QuizNode = z.infer<typeof nodeSchema>;
export type QuizGraph = z.infer<typeof graphSchema>;
export type QuizDraft = z.infer<typeof draftSchema>;
export type Snapshot = { nodeId: string; phase: "ready" | "waiting" | "completed" | "human" | "stopped"; answers: Record<string, Value>; fields: Record<string, Value>; tags: string[]; email: string | null; interest: boolean; completedNodeIds: string[] };
export type QuizInput = { kind: "answer"; value: string; choiceId?: string } | { kind: "skip" } | { kind: "stop" };
export type QuizMessage = { text: string; buttons: ({ kind: "answer"; id: string; label: string } | { kind: "skip"; label: string })[]; material?: { name: string; url: string } };
export type Transition = { after: Snapshot; outbound?: QuizMessage; error?: "INVALID_EMAIL" | "ANSWER_REQUIRED" | "INVALID_CHOICE" | "UNEXPECTED_INPUT" };
export type Qualification = { qualified: boolean; reasons: string[] };
export type GraphIssue = { nodeId?: string; code: string; message: string };
