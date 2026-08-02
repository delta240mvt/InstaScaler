import type { JobResult } from "@/lib/delivery";

type FollowGateContext = {
  checkFollowStatus(instagramAccountId: string, userId: string): Promise<boolean>;
  reserveDelivery(): Promise<boolean>;
  sendPrompt(): Promise<void> | void;
  sendFreebie(): Promise<void> | void;
};

type FollowGateInput = {
  requireFollowBeforeFreebie: boolean;
  isPostback: boolean;
  instagramAccountId: string;
  userId: string;
};

export async function deliverFollowProtectedFreebie(context: FollowGateContext, input: FollowGateInput): Promise<JobResult> {
  if (!input.requireFollowBeforeFreebie) {
    await context.sendFreebie();
    return { status: "sent", code: "FREEBIE_SENT" };
  }
  if (!input.isPostback) {
    await context.sendPrompt();
    return { status: "skipped", code: "FOLLOW_PROMPT_SENT" };
  }
  if (!await context.checkFollowStatus(input.instagramAccountId, input.userId)) {
    await context.sendPrompt();
    return { status: "skipped", code: "FOLLOW_REQUIRED" };
  }
  if (!await context.reserveDelivery()) return { status: "skipped", code: "DELIVERY_ALREADY_RESERVED" };
  await context.sendFreebie();
  return { status: "sent", code: "FREEBIE_SENT" };
}
