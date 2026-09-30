import type { eventWithTime } from "@rrweb/types";
import type { AnnotationDocument } from "./annotations.js";
export type Position = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type CaptureModule = "screenshot" | "replay";
export interface ReplayOptions {
  maxDurationMs?: number;
  maxBytes?: number;
  blockSelector?: string;
  maskTextSelector?: string;
}
export interface MountOptions {
  /** Bot body color as a CSS color. Defaults to #a27ff6. */
  botColor?: string;
  /** Bot eye color as a CSS color. Defaults to #ffffff. */
  botEyeColor?: string;
  position?: Position;
  modules?: Array<CaptureModule>;
  replay?: ReplayOptions;
  container?: HTMLElement;
}
export interface CaptureMetadata {
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
  scrollX: number;
  scrollY: number;
  capturedAt: number;
  warnings: Array<string>;
}
export interface CaptureResult {
  canvas: HTMLCanvasElement;
  metadata: CaptureMetadata;
}
export type StopReason = "manual" | "duration-limit" | "size-limit";
export interface ReplayMetadata {
  startedAt: number;
  endedAt: number;
  durationMs: number;
  elapsedMs: number;
  eventCount: number;
  stopReason: StopReason;
}
export interface ReplayArtifact {
  schemaVersion: 1;
  rrwebVersion: string;
  metadata: ReplayMetadata;
  events: Array<eventWithTime>;
}
export type AcceptDetail =
  | { kind: "screenshot"; blob: Blob; annotations: AnnotationDocument; capture: CaptureMetadata }
  | {
      kind: "replay";
      blob: Blob;
      replay: ReplayMetadata & { schemaVersion: 1; rrwebVersion: string };
    };
export interface DiscardDetail {
  kind: CaptureModule;
}
export interface ErrorDetail {
  kind: CaptureModule;
  operation: "capture" | "record" | "preview" | "export";
  message: string;
}
export interface SondaEventMap {
  "sonda-accept": CustomEvent<AcceptDetail>;
  "sonda-discard": CustomEvent<DiscardDetail>;
  "sonda-error": CustomEvent<ErrorDetail>;
}
