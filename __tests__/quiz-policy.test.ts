import { expect, it } from "vitest";
import { canSendQuizMessage, sourceTimestamp } from "@/lib/delivery/quiz-policy";
import { decodeQuizPayload, encodeQuizPayload } from "@/lib/delivery/quiz-payload";

it("uses source time and closes exactly at 24h, while comments permit only opening", () => {
  const now = new Date("2026-09-08T12:00:00Z");
  expect(canSendQuizMessage({ now, lastInteractionAt: new Date("2026-09-07T12:00:00Z"), opening: false, blocked: false, commentCreatedAt: now })).toBe(false);
  expect(canSendQuizMessage({ now, lastInteractionAt: null, opening: false, blocked: false, commentCreatedAt: now })).toBe(false);
  expect(canSendQuizMessage({ now, lastInteractionAt: null, opening: true, blocked: false, commentCreatedAt: now })).toBe(true);
  expect(sourceTimestamp(Date.parse("2026-09-08T13:00:00Z"), now, "ms")).toBeNull();
  expect(sourceTimestamp(undefined, now, "ms")).toBeNull();
});
it("roundtrips bounded context and rejects malformed or oversized quiz payloads", () => {
  const context = { runId: "run1", versionId: "v1", revision: 3, nodeId: "email", choiceId: "", action: "skip" as const };
  expect(decodeQuizPayload(encodeQuizPayload(context))).toEqual(context);
  expect(decodeQuizPayload("quiz1:{}")).toBeNull();
  expect(decodeQuizPayload("quiz1:" + "x".repeat(1001))).toBeNull();
});
