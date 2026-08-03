import { describe, expect, it } from "vitest";
import { selectPublicReply } from "@/lib/delivery/public-reply-choice";

describe("public reply selection", () => {
  it("uses the supplied random value to choose among all configured variants", () => {
    const replies = ["Pierwsza", "Druga", "Trzecia"];

    expect(selectPublicReply(replies, () => 0)).toBe("Pierwsza");
    expect(selectPublicReply(replies, () => 0.4)).toBe("Druga");
    expect(selectPublicReply(replies, () => 0.9)).toBe("Trzecia");
  });
});
