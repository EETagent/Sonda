import { svg } from "lit";
export type IconName =
  | "capture"
  | "record"
  | "close"
  | "pen"
  | "text"
  | "select"
  | "undo"
  | "redo"
  | "trash"
  | "check"
  | "arrow"
  | "move"
  | "play"
  | "pause"
  | "stop"
  | "chevron"
  | "lock"
  | "info";
const paths: Record<IconName, string> = {
  capture:
    "M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3M8 8h8v8H8z",
  record: "M15 8l6-3v14l-6-3M3 6h12v12H3z",
  close: "M6 6l12 12M18 6L6 18",
  pen: "M15 4l5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z",
  text: "M4 5h16M12 5v15M8 20h8",
  select: "M4 3l6 18 3-8 8-3z",
  undo: "M8 4L3 9l5 5M3 9h10a7 7 0 0 1 0 14",
  redo: "M16 4l5 5-5 5m5-5H11a7 7 0 0 0 0 14",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15",
  check: "M5 12l4 4L19 6",
  arrow: "M5 12h14m-5-5l5 5-5 5",
  move: "M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3",
  play: "M7 4l14 8-14 8z",
  pause: "M8 4v16M16 4v16",
  stop: "M5 5h14v14H5z",
  chevron: "M9 5l7 7-7 7",
  lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3",
  info: "M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
};
export const icon = (name: IconName) =>
  svg`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${paths[name]} /></svg>`;
