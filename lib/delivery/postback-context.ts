export type PostbackKind = "reveal" | "followcheck";

export function postbackPayload(kind: PostbackKind, automationId: string, deliveryKey?: string): string {
  return deliveryKey ? `${kind}:${automationId}:${deliveryKey}` : `${kind}:${automationId}`;
}

export function parsePostbackPayload(payload: string): {
  kind: PostbackKind;
  automationId: string;
  deliveryKey?: string;
} | null {
  const [kind, automationId, deliveryKey] = payload.split(":", 3);
  if ((kind !== "reveal" && kind !== "followcheck") || !automationId) return null;
  return { kind, automationId, ...(deliveryKey ? { deliveryKey } : {}) };
}

export function deliveryExternalId(automationId: string, deliveryKey: string | undefined, userId: string): string {
  return `freebie:${automationId}:${deliveryKey || userId}`;
}
