export type InitialCommentDmPlan = {
  mode: "opening" | "followPrompt" | "freebie";
  postbackKind: "reveal" | "followcheck" | null;
};

export function initialCommentDmPlan(input: { openingDmEnabled: boolean; requireFollowBeforeFreebie: boolean }): InitialCommentDmPlan {
  if (input.openingDmEnabled) return { mode: "opening", postbackKind: "reveal" };
  if (input.requireFollowBeforeFreebie) return { mode: "followPrompt", postbackKind: "followcheck" };
  return { mode: "freebie", postbackKind: null };
}
