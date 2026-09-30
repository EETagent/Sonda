export type HandoffDestination = "cursor" | "slack" | "linear" | "github";

export const handoffDestinations = [
  {
    id: "cursor",
    label: "Cursor Agent",
    action: "Investigate and fix",
    hint: "Ask Cursor to investigate this issue and propose a fix…",
  },
  {
    id: "slack",
    label: "Slack",
    action: "Share with the team",
    hint: "Tell your team what happened and what needs attention…",
  },
  {
    id: "linear",
    label: "Linear",
    action: "Create an issue",
    hint: "Describe the issue, expected behavior, and priority…",
  },
  {
    id: "github",
    label: "GitHub",
    action: "Draft a bug report",
    hint: "Turn this report into a clear, reproducible GitHub issue…",
  },
] as const satisfies ReadonlyArray<{
  id: HandoffDestination;
  label: string;
  action: string;
  hint: string;
}>;
