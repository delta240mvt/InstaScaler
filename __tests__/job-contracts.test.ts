import { describe, expect, it } from "vitest";
import { parseInstagramJob } from "@/lib/jobs/contracts";

const r2Job = {
  version: 1,
  externalId: "event-1",
  instagramAccountId: "account-1",
  r2Key: "events/account-1/event-1.json",
};

describe("Instagram job contracts", () => {
  it.each(["COMMENT", "POSTBACK", "MESSAGE", "RECOVER_R2"] as const)(
    "accepts a journal-backed %s job",
    (kind) => {
      expect(parseInstagramJob({ ...r2Job, kind })).toMatchObject({ kind });
    },
  );

  it("accepts an internal follow-up without an R2 journal key", () => {
    expect(
      parseInstagramJob({
        version: 1,
        kind: "FOLLOW_UP",
        externalId: "follow-up-1",
        instagramAccountId: "account-1",
        automationId: "automation-1",
        userId: "ig-user-1",
        commenterName: "Maja",
        dueAt: "2026-08-02T12:00:00.000Z",
      }),
    ).toMatchObject({ kind: "FOLLOW_UP" });
  });

  it.each([
    { ...r2Job, kind: "COMMENT", externalId: "" },
    { ...r2Job, kind: "COMMENT", instagramAccountId: "" },
    { ...r2Job, kind: "COMMENT", r2Key: "" },
  ])("rejects incomplete journal-backed jobs", (value) => {
    expect(() => parseInstagramJob(value)).toThrow();
  });
});
