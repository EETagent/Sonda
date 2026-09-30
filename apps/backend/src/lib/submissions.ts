export interface ScreenshotInfo {
  filename: "screenshot.png";
  bytes: number;
  width: number;
  height: number;
}

export interface ReplayInfo {
  filename: "replay.json";
  bytes: number;
  eventCount: number;
  durationMs: number;
  rrwebVersion: string | null;
}

export interface Submission {
  id: string;
  title: string;
  description: string;
  url: string | null;
  createdAt: string;
  screenshot: ScreenshotInfo | null;
  replay: ReplayInfo | null;
  metadata: Record<string, unknown>;
}

export type ArtifactKind = "screenshot" | "replay";

export const artifactUrl = (id: string, kind: ArtifactKind): string => {
  return `/api/v1/submissions/${encodeURIComponent(id)}/${kind}`;
};

export const formatBytes = (bytes: number): string => {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
