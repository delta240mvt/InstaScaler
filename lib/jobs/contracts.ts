import { z } from "zod";

const baseJobSchema = z.object({
  version: z.literal(1),
  externalId: z.string().min(1).max(255),
  instagramAccountId: z.string().min(1).max(255),
});

const journalJobSchema = baseJobSchema.extend({
  r2Key: z.string().min(1).max(512),
});

const followUpJobSchema = baseJobSchema.extend({
  r2Key: z.string().min(1).max(512).optional(),
  automationId: z.string().min(1).max(255),
  userId: z.string().min(1).max(255),
  commenterName: z.string().min(1).max(255).optional(),
  dueAt: z.string().datetime(),
});

const instagramJobSchema = z.discriminatedUnion("kind", [
  journalJobSchema.extend({ kind: z.literal("COMMENT") }),
  journalJobSchema.extend({ kind: z.literal("POSTBACK") }),
  followUpJobSchema.extend({ kind: z.literal("FOLLOW_UP") }),
  journalJobSchema.extend({ kind: z.literal("MESSAGE") }),
  journalJobSchema.extend({ kind: z.literal("RECOVER_R2") }),
]);

export type InstagramJob = z.infer<typeof instagramJobSchema>;

export function parseInstagramJob(value: unknown): InstagramJob {
  return instagramJobSchema.parse(value);
}
