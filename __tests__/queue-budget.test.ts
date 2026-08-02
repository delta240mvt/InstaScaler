import { describe, expect, it } from "vitest";
import { estimateQueueOperations, validateDelaySeconds } from "@/lib/jobs/budget";

describe("Queue Free budget", () => {
  it("budgets three operations per message and an extra read per retry", () => {
    expect(estimateQueueOperations({ messages: 2, retries: 1 })).toBe(7);
  });
  it("accepts follow-up delays through 24 hours only", () => {
    expect(validateDelaySeconds(0)).toBe(0);
    expect(validateDelaySeconds(86_400)).toBe(86_400);
    expect(() => validateDelaySeconds(86_401)).toThrow();
  });
});
