import { EventType, type eventWithTime } from "@rrweb/types";
import type { ReplayArtifact, ReplayOptions, StopReason } from "./types.js";

interface RecordingCallbacks {
  onStop?: (artifact: ReplayArtifact) => void;
  onError?: (error: Error) => void;
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_DURATION_MS = 120_000;
// Reserve space for the artifact metadata and JSON envelope around the events.
const ARTIFACT_OVERHEAD_BYTES = 1024;
const RRWEB_VERSION = "2.1.6";

// rrweb owns global observers, so only one session may record at a time.
let owner: RecordingSession | undefined;
const encoder = new TextEncoder();
const serializedBytes = (value: unknown): number => encoder.encode(JSON.stringify(value)).length;

export const sanitizeEvent = (event: eventWithTime): eventWithTime => {
  const copy = structuredClone(event);
  if (copy.type === EventType.Meta) {
    try {
      const url = new URL(copy.data.href);
      url.username = "";
      url.password = "";
      url.search = "";
      url.hash = "";
      copy.data.href = url.href;
    } catch {
      copy.data.href = "";
    }
  }
  return copy;
};
export class RecordingSession {
  private events: Array<eventWithTime> = [];
  private stopHandle?: () => void;
  private addEnd?: () => void;
  private timer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private accepting = false;
  private starting = false;
  private stopping = false;
  private pendingStopReason?: StopReason;
  private retainedBytes = ARTIFACT_OVERHEAD_BYTES;
  private readonly maxBytes: number;
  private readonly maxDurationMs: number;
  private startTime = 0;
  constructor(
    private readonly options: ReplayOptions = {},
    private readonly callbacks: RecordingCallbacks = {},
  ) {
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
    if (
      !Number.isFinite(this.maxBytes) ||
      this.maxBytes < 2048 ||
      !Number.isFinite(this.maxDurationMs) ||
      this.maxDurationMs < 100
    )
      throw new Error("Replay limits must be at least 2048 bytes and 100 ms.");
  }
  get startedAt(): number {
    return this.startTime;
  }
  get active(): boolean {
    return this.accepting;
  }
  async start(): Promise<void> {
    if (this.accepting || this.starting) throw new Error("This recording is already active.");
    if (owner && owner !== this) throw new Error("Another Sonda recording is already active.");
    // Track the active recorder across instances, not an alias for use in callbacks.
    // oxlint-disable-next-line typescript/no-this-alias
    owner = this;
    this.starting = true;
    const token = ++this.generation;
    try {
      const { record } = await import("@rrweb/record");
      if (token !== this.generation) return;
      this.events = [];
      this.retainedBytes = ARTIFACT_OVERHEAD_BYTES;
      this.startTime = Date.now();
      this.accepting = true;
      this.addEnd = () => record.addCustomEvent("sonda:end", { reason: "stop" });
      this.stopHandle = record({
        emit: (event: eventWithTime) => this.retainEvent(event, token),
        maskAllInputs: true,
        blockSelector: ["[data-sonda-widget]", "[data-replay-private]", this.options.blockSelector]
          .filter(Boolean)
          .join(", "),
        maskTextSelector: ["[data-replay-mask]", "[contenteditable]", this.options.maskTextSelector]
          .filter(Boolean)
          .join(", "),
        recordCanvas: false,
        recordCrossOriginIframes: false,
        inlineImages: false,
        collectFonts: false,
        plugins: [],
        sampling: { mousemove: 100, scroll: 150, input: "all" },
      });
      this.starting = false;
      if (!this.stopHandle) throw new Error("rrweb could not start recording this document.");
      // rrweb can emit synchronously before it returns its stop handle. Defer
      // limit-triggered stops until that handle exists so observers get released.
      if (this.pendingStopReason) {
        const reason = this.pendingStopReason;
        this.pendingStopReason = undefined;
        this.stop(reason);
        return;
      }
      this.timer = setTimeout(() => this.stop("duration-limit"), this.maxDurationMs);
    } catch (error) {
      if (token !== this.generation) return;
      this.discard();
      throw error;
    }
  }
  private retainEvent(event: eventWithTime, token: number): void {
    if (!this.accepting || token !== this.generation) return;
    // Custom events include the tail marker that preserves elapsed idle time.
    if (Date.now() - this.startTime >= this.maxDurationMs && event.type !== EventType.Custom) {
      this.stop("duration-limit");
      return;
    }
    const sanitized = sanitizeEvent(event);
    const size = serializedBytes(sanitized) + 1;
    if (this.retainedBytes + size > this.maxBytes) {
      if (!this.stopping) this.stop("size-limit");
      return;
    }
    this.events.push(sanitized);
    this.retainedBytes += size;
  }

  stop(reason: StopReason = "manual"): void {
    if (this.starting) {
      this.pendingStopReason = reason;
      this.accepting = false;
      return;
    }
    if (!this.stopHandle || this.stopping) return;
    this.stopping = true;
    try {
      try {
        // A custom tail marker preserves idle time without a fake video duration.
        if (this.accepting && reason !== "size-limit") this.addEnd?.();
      } finally {
        // Release observers and ownership even if adding the tail marker fails.
        this.releaseRecorder();
      }
    } catch (cause) {
      this.events = [];
      this.reportError(cause);
      return;
    }
    const hasInitialSnapshot =
      this.events.some((event) => event.type === EventType.FullSnapshot) &&
      this.events.some((event) => event.type === EventType.Meta);
    if (!hasInitialSnapshot) {
      this.events = [];
      this.callbacks.onError?.(
        new Error("The initial page snapshot exceeds the recording limit or is unavailable."),
      );
      return;
    }
    const endedAt = Date.now();
    const firstTimestamp = this.events[0].timestamp;
    const lastTimestamp = this.events[this.events.length - 1].timestamp;
    const artifact: ReplayArtifact = {
      schemaVersion: 1,
      rrwebVersion: RRWEB_VERSION,
      metadata: {
        startedAt: this.startTime,
        endedAt,
        durationMs: Math.max(0, lastTimestamp - firstTimestamp),
        elapsedMs: endedAt - this.startTime,
        eventCount: this.events.length,
        stopReason: reason,
      },
      events: this.events,
    };
    this.events = [];
    this.callbacks.onStop?.(artifact);
  }
  discard(): void {
    ++this.generation;
    this.events = [];
    try {
      this.releaseRecorder();
    } catch (cause) {
      this.reportError(cause);
    }
  }

  private reportError(cause: unknown): void {
    this.callbacks.onError?.(cause instanceof Error ? cause : new Error(String(cause)));
  }

  private releaseRecorder(): void {
    this.accepting = false;
    this.starting = false;
    this.pendingStopReason = undefined;
    clearTimeout(this.timer);
    this.timer = undefined;
    const stop = this.stopHandle;
    this.stopHandle = undefined;
    this.addEnd = undefined;
    try {
      stop?.();
    } finally {
      this.stopping = false;
      if (owner === this) owner = undefined;
    }
  }
}
