export type DeliveryLink = {
  slug?: string;
  destinationUrl?: string | null;
};

/** Returns the URL configured in the campaign, never the analytics redirect. */
export function directDeliveryLink(links?: DeliveryLink[]): string | undefined {
  const destination = links?.find(
    (link) => typeof link.destinationUrl === "string" && link.destinationUrl.trim().length > 0,
  )?.destinationUrl;

  return destination?.trim() || undefined;
}
