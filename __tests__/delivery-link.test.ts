import { describe, expect, it } from "vitest";
import { directDeliveryLink } from "@/lib/delivery/link-destination";

describe("direct delivery links", () => {
  it("returns the destination URL instead of a tracking redirect", () => {
    expect(
      directDeliveryLink([
        { slug: "abc123", destinationUrl: "https://google.com" },
      ]),
    ).toBe("https://google.com");
  });

  it("ignores empty destinations", () => {
    expect(directDeliveryLink([{ slug: "abc123", destinationUrl: "  " }])).toBeUndefined();
  });
});
