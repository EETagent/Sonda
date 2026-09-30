import { LitElement, html, nothing } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { defineBuddyAvatar } from "@sonda/buddy";
import type {
  AcceptDetail,
  CaptureModule,
  CaptureResult,
  ErrorDetail,
  Position,
  ReplayArtifact,
  ReplayOptions,
  SondaEventMap,
} from "./types.js";
import { ScreenshotEditor } from "./screenshot-editor.js";
import { exportScreenshot } from "./renderer.js";
import { widgetStyles } from "./widget-styles.js";
import { icon } from "./icons.js";
import type { RecordingSession } from "./recording.js";
import type { PlaybackState, ReplayPreview } from "./replay-preview.js";

type State =
  | "ready"
  | "capturing"
  | "editing"
  | "recording-starting"
  | "recording"
  | "replay-loading"
  | "replay-review"
  | "exporting";
const formatTime = (ms: number): string =>
  `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export class SondaCapture extends LitElement {
  static styles = widgetStyles;
  static properties = {
    position: { reflect: true },
    botColor: { attribute: "bot-color", reflect: true },
    botEyeColor: { attribute: "bot-eye-color", reflect: true },
    modules: { attribute: false },
    replay: { attribute: false },
    state: { state: true },
    panelOpen: { state: true },
    error: { state: true },
    elapsed: { state: true },
    playback: { state: true },
    playbackSpeed: { state: true },
  };
  declare position: Position;
  declare botColor: string;
  declare botEyeColor: string;
  declare modules: Array<CaptureModule>;
  declare replay: ReplayOptions;
  declare private state: State;
  declare private panelOpen: boolean;
  declare private error: string;
  declare private elapsed: number;
  declare private playback: PlaybackState;
  declare private playbackSpeed: number;
  private kind: CaptureModule = "screenshot";
  private screenshot?: CaptureResult;
  private artifact?: ReplayArtifact;
  private recorder?: RecordingSession;
  private player?: ReplayPreview;
  private generation = 0;
  private timer?: ReturnType<typeof setInterval>;
  private focusTarget?: HTMLElement;
  private lastErrorOperation?: ErrorDetail["operation"];

  constructor() {
    super();
    this.position = "bottom-right";
    this.botColor = "#a27ff6";
    this.botEyeColor = "#ffffff";
    this.modules = ["screenshot", "replay"];
    this.replay = {};
    this.state = "ready";
    this.panelOpen = false;
    this.error = "";
    this.elapsed = 0;
    this.playback = { currentTime: 0, duration: 0, playing: false };
    this.playbackSpeed = 1;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("data-sonda-widget", "");
    defineBuddyAvatar();
    if (!customElements.get("sonda-screenshot-editor"))
      customElements.define("sonda-screenshot-editor", ScreenshotEditor);
    document.addEventListener("pointerdown", this.outsideClick, true);
  }

  disconnectedCallback(): void {
    document.removeEventListener("pointerdown", this.outsideClick, true);
    this.cleanup(false);
    super.disconnectedCallback();
  }

  /** Stop capture/recording, release all owned resources, and remove this widget. */
  destroy(): void {
    this.cleanup(false);
    this.remove();
  }

  private outsideClick = (event: PointerEvent): void => {
    if (this.panelOpen && !event.composedPath().includes(this)) this.panelOpen = false;
  };

  private emit<K extends keyof SondaEventMap>(name: K, detail: SondaEventMap[K]["detail"]): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private rememberFocus(): void {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    this.focusTarget = active instanceof HTMLElement ? active : undefined;
  }

  private async restoreFocus(token: number): Promise<void> {
    await this.updateComplete;
    if (!this.valid(token)) return;
    const target = this.focusTarget;
    if (target?.isConnected && !target.closest("dialog:not([open])")) {
      target.focus({ preventScroll: true });
      if (target.matches(":focus")) return;
    }
    if (!this.shadowRoot?.activeElement || this.shadowRoot.activeElement.tagName === "DIALOG") {
      this.renderRoot.querySelector<HTMLButtonElement>(".launcher")?.focus({ preventScroll: true });
    }
  }

  private async openDialog(token: number): Promise<boolean> {
    await this.updateComplete;
    if (!this.valid(token)) return false;
    const dialog = this.renderRoot.querySelector<HTMLDialogElement>("dialog");
    if (!dialog) return false;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-initial-focus]")?.focus({ preventScroll: true });
    return true;
  }

  private valid(token: number): boolean {
    return token === this.generation && this.isConnected;
  }

  private fail(kind: CaptureModule, operation: ErrorDetail["operation"], error: unknown): void {
    this.error = error instanceof Error ? error.message : String(error);
    this.lastErrorOperation = operation;
    this.emit("sonda-error", { kind, operation, message: this.error });
  }

  /** Capture the currently visible viewport; no automatic submission. */
  async captureScreenshot(): Promise<void> {
    if (!this.isConnected || this.state !== "ready" || !this.modules.includes("screenshot")) return;
    this.rememberFocus();
    this.kind = "screenshot";
    const token = ++this.generation;
    this.state = "capturing";
    this.panelOpen = false;
    this.error = "";
    try {
      const { captureViewport } = await import("./capture.js");
      if (!this.valid(token)) return;
      const result = await captureViewport();
      if (!this.valid(token)) {
        result.canvas.width = result.canvas.height = 0;
        return;
      }
      this.screenshot = result;
      this.state = "editing";
      await this.openDialog(token);
    } catch (error) {
      if (!this.valid(token)) return;
      this.state = "ready";
      this.panelOpen = true;
      this.fail("screenshot", "capture", error);
    }
  }

  /** Begin an explicit in-memory rrweb session. Never called at mount time. */
  async startRecording(): Promise<void> {
    if (!this.isConnected || this.state !== "ready" || !this.modules.includes("replay")) return;
    this.rememberFocus();
    this.kind = "replay";
    const token = ++this.generation;
    this.state = "recording-starting";
    this.panelOpen = false;
    this.error = "";
    this.elapsed = 0;
    try {
      const { RecordingSession } = await import("./recording.js");
      if (!this.valid(token)) return;
      this.recorder = new RecordingSession(this.replay, {
        onStop: (artifact) => {
          if (!this.valid(token)) return;
          this.clearRecordingTimer();
          this.artifact = artifact;
          void this.loadReplay(token);
        },
        onError: (error) => {
          if (!this.valid(token)) return;
          this.clearRecordingTimer();
          this.state = "ready";
          this.panelOpen = true;
          this.fail("replay", "record", error);
        },
      });
      await this.recorder.start();
      if (!this.valid(token) || this.state !== "recording-starting") return;
      this.state = "recording";
      this.timer = setInterval(() => {
        this.elapsed = Date.now() - (this.recorder?.startedAt ?? Date.now());
      }, 250);
    } catch (error) {
      if (!this.valid(token)) return;
      this.recorder?.discard();
      this.recorder = undefined;
      this.state = "ready";
      this.panelOpen = true;
      this.fail("replay", "record", error);
    }
  }

  stopRecording(): void {
    if (this.state === "recording") this.recorder?.stop("manual");
  }

  private async loadReplay(token: number): Promise<void> {
    if (!this.artifact || !this.valid(token)) return;
    this.player?.destroy();
    this.player = undefined;
    this.state = "replay-loading";
    this.playback = { currentTime: 0, duration: 0, playing: false };
    this.playbackSpeed = 1;
    this.error = "";
    try {
      if (!(await this.openDialog(token))) return;
      const { createReplayPreview } = await import("./replay-preview.js");
      if (!this.valid(token)) return;
      const container = this.renderRoot.querySelector<HTMLElement>(".preview");
      if (!container) throw new Error("The replay preview is no longer available.");
      const player = await createReplayPreview(container, this.artifact, (playback) => {
        if (this.valid(token)) this.playback = playback;
      });
      if (!this.valid(token)) {
        player.destroy();
        return;
      }
      this.player = player;
      this.state = "replay-review";
    } catch (error) {
      if (!this.valid(token)) return;
      this.state = "replay-review";
      this.fail("replay", "preview", error);
    }
  }

  private async accept(): Promise<void> {
    if (this.state !== "editing" && this.state !== "replay-review") return;
    if (this.kind === "replay" && !this.player) return;
    const previousState = this.state;
    const token = this.generation;
    this.state = "exporting";
    this.error = "";
    try {
      let result: AcceptDetail;
      if (this.kind === "screenshot" && this.screenshot) {
        const editor = this.renderRoot.querySelector<ScreenshotEditor>("sonda-screenshot-editor");
        if (!editor) throw new Error("The screenshot editor is no longer available.");
        const annotations = editor.getDocument();
        const blob = await exportScreenshot(this.screenshot.canvas, annotations);
        result = {
          kind: "screenshot",
          blob,
          annotations,
          capture: structuredClone(this.screenshot.metadata),
        };
      } else if (this.artifact) {
        this.player?.pause();
        const blob = new Blob([JSON.stringify(this.artifact)], { type: "application/json" });
        result = {
          kind: "replay",
          blob,
          replay: {
            ...this.artifact.metadata,
            schemaVersion: 1,
            rrwebVersion: this.artifact.rrwebVersion,
          },
        };
      } else throw new Error("The capture is no longer available.");
      if (!this.valid(token)) return;
      this.cleanup(true);
      this.emit("sonda-accept", result);
    } catch (error) {
      if (!this.valid(token)) return;
      this.state = previousState;
      this.fail(this.kind, "export", error);
    }
  }

  discard(): void {
    const kind = this.kind;
    const hadSession = this.state !== "ready" || !!this.error;
    this.cleanup(true);
    if (hadSession) this.emit("sonda-discard", { kind });
  }

  private clearRecordingTimer(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private cleanup(focus: boolean): void {
    ++this.generation;
    this.clearRecordingTimer();
    this.recorder?.discard();
    this.recorder = undefined;
    this.player?.destroy();
    this.player = undefined;
    const dialog = this.renderRoot.querySelector<HTMLDialogElement>("dialog");
    dialog?.close();
    if (this.screenshot) this.screenshot.canvas.width = this.screenshot.canvas.height = 0;
    this.screenshot = undefined;
    this.artifact = undefined;
    this.state = "ready";
    this.panelOpen = false;
    this.error = "";
    this.lastErrorOperation = undefined;
    if (focus && this.isConnected) void this.restoreFocus(this.generation);
  }

  private retry(): void {
    if (this.lastErrorOperation === "preview") void this.loadReplay(++this.generation);
    else if (this.lastErrorOperation === "export") void this.accept();
    else if (this.kind === "screenshot") void this.captureScreenshot();
    else void this.startRecording();
  }

  private closePanel(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    this.dismissPanel();
  }

  private dismissPanel(): void {
    this.panelOpen = false;
    this.renderRoot.querySelector<HTMLButtonElement>(".launcher")?.focus();
  }

  private changeSpeed(event: Event): void {
    this.playbackSpeed = Number((event.currentTarget as HTMLSelectElement).value);
    this.player?.setSpeed(this.playbackSpeed);
  }

  private renderStatus() {
    return html`
      <div class="status-pill" role="status">
        ${
          this.state === "recording"
            ? html`
                <span class="record-dot"></span>
                <span class="time">${formatTime(this.elapsed)}</span>
                <button @click=${this.stopRecording}>${icon("stop")} Stop</button>
              `
            : html`<span
                >${this.state === "capturing" ? "Capturing…" : "Starting recording…"}</span
              >`
        }
        <button aria-label="Discard" class="icon" @click=${this.discard}>${icon("close")}</button>
      </div>
    `;
  }

  private renderCaptureOptions() {
    return html`
      <section
        class="panel"
        id="capture-options"
        aria-label="Capture options"
        @keydown=${this.closePanel}
      >
        <header class="panel-head">
          <h2>Capture</h2>
          <button class="icon" aria-label="Close capture options" @click=${this.dismissPanel}>
            ${icon("close")}
          </button>
        </header>
        ${
          this.error
            ? html`
                <div class="error" role="alert">
                  ${this.error}
                  <div>
                    <button @click=${this.retry}>Retry</button
                    ><button @click=${this.discard}>Discard</button>
                  </div>
                </div>
              `
            : nothing
        }
        ${
          this.modules.includes("screenshot")
            ? html`
                <button class="choice" @click=${this.captureScreenshot}>
                  <span class="choice-icon">${icon("capture")}</span>
                  <span
                    ><strong>Capture screenshot</strong
                    ><small>Mark up the current view</small></span
                  >
                  <span class="choice-chevron">${icon("chevron")}</span>
                </button>
              `
            : nothing
        }
        ${
          this.modules.includes("replay")
            ? html`
                <button class="choice" @click=${this.startRecording}>
                  <span class="choice-icon">${icon("record")}</span>
                  <span
                    ><strong>Record session</strong><small>Show the steps to reproduce</small></span
                  >
                  <span class="choice-chevron">${icon("chevron")}</span>
                </button>
              `
            : nothing
        }
        <details class="privacy">
          <summary>${icon("lock")}<span>Private until you accept</span>${icon("chevron")}</summary>
          <p>
            Captures stay on your device until you accept.
            ${this.modules.includes("replay") ? "Recordings include page content, including areas off screen. Form inputs are masked. No camera or microphone." : nothing}
          </p>
        </details>
      </section>
    `;
  }

  private togglePlayback(): void {
    if (this.playback.playing) this.player?.pause();
    else this.player?.play();
  }

  private seekPlayback(event: Event): void {
    this.player?.seek(Number((event.currentTarget as HTMLInputElement).value));
  }

  private cancelReview(event: Event): void {
    event.preventDefault();
    this.discard();
  }

  private renderPlaybackControls() {
    const disabled = !this.player || this.state === "exporting";
    return html`
      <div class="playback">
        <button
          aria-label=${this.playback.playing ? "Pause replay" : "Play replay"}
          ?disabled=${disabled}
          @click=${this.togglePlayback}
        >
          ${icon(this.playback.playing ? "pause" : "play")}
        </button>
        <button
          aria-label="Restart replay"
          ?disabled=${disabled}
          @click=${() => this.player?.restart()}
        >
          ${icon("undo")}
        </button>
        <input
          aria-label="Replay position"
          type="range"
          min="0"
          max=${Math.max(1, this.playback.duration)}
          step="100"
          .value=${String(this.playback.currentTime)}
          ?disabled=${disabled}
          @input=${this.seekPlayback}
        />
        <time
          >${formatTime(this.playback.currentTime)} / ${formatTime(this.playback.duration)}</time
        >
        <select
          aria-label="Playback speed"
          .value=${String(this.playbackSpeed)}
          ?disabled=${disabled}
          @change=${this.changeSpeed}
        >
          <option value="0.5">0.5×</option>
          <option value="1">1×</option>
          <option value="2">2×</option>
        </select>
      </div>
    `;
  }

  private renderScreenshotReview() {
    if (!this.screenshot) return nothing;
    const warnings = this.screenshot.metadata.warnings;
    return html`
      ${
        warnings.length
          ? html`<div class="capture-notice" role="status">
              ${icon("info")}
              <span
                >Some page details may look different or be missing. Check the preview before
                accepting.</span
              >
            </div>`
          : nothing
      }
      <sonda-screenshot-editor
        .capture=${this.screenshot}
        .disabled=${this.state === "exporting"}
      ></sonda-screenshot-editor>
    `;
  }

  private renderReplayReview() {
    const stopReason = this.artifact?.metadata.stopReason;
    return html`
      ${
        stopReason && stopReason !== "manual"
          ? html`<div class="notice">
              Recording stopped at the ${stopReason === "size-limit" ? "size" : "time"} limit.
              Review the captured portion below.
            </div>`
          : nothing
      }
      <div class="preview" aria-label="Session replay preview"></div>
      ${this.state === "replay-loading" ? html`<div class="loading" role="status">Preparing your replay…</div>` : nothing}
      ${this.renderPlaybackControls()}
    `;
  }

  private renderReviewDialog() {
    const screenshot = this.kind === "screenshot";
    const accepting = this.state === "exporting";
    const acceptDisabled =
      accepting || this.state === "replay-loading" || (!screenshot && !this.player);
    return html`
      <dialog aria-labelledby="review-title" @cancel=${this.cancelReview}>
        <header class="dialog-head">
          <div class="dialog-heading">
            <span class="document-icon">${icon(screenshot ? "capture" : "record")}</span>
            <h2 id="review-title" tabindex="-1" data-initial-focus>
              ${screenshot ? "Annotate screenshot" : "Review session replay"}
            </h2>
          </div>
          ${screenshot && this.screenshot ? html`<span class="capture-dimensions">${this.screenshot.metadata.width} × ${this.screenshot.metadata.height}</span>` : nothing}
          <button class="icon" aria-label="Close review" @click=${this.discard}>
            ${icon("close")}
          </button>
        </header>
        ${
          this.error
            ? html`<div class="notice" role="alert">
                ${this.error} <button @click=${this.retry}>Retry</button>
              </div>`
            : nothing
        }
        ${screenshot ? this.renderScreenshotReview() : this.renderReplayReview()}
        <footer class="dialog-foot">
          <span class="hint">${icon("lock")} Not shared yet</span>
          <button class="quiet" @click=${this.discard}>Discard</button>
          <button class="primary" ?disabled=${acceptDisabled} @click=${this.accept}>
            ${icon("check")}${accepting ? "Preparing…" : "Accept"}
          </button>
        </footer>
      </dialog>
    `;
  }

  protected render() {
    const busy = ["capturing", "recording-starting", "recording"].includes(this.state);
    const reviewing = ["editing", "replay-loading", "replay-review", "exporting"].includes(
      this.state,
    );
    const active = this.panelOpen || this.state !== "ready";
    const launcherLabel =
      this.state === "recording"
        ? "Session recording"
        : busy
          ? "Capture in progress"
          : this.panelOpen
            ? "Close capture tools"
            : "Open capture tools";
    return html`
      ${busy ? this.renderStatus() : this.panelOpen ? this.renderCaptureOptions() : nothing}
      <button
        type="button"
        class="launcher"
        aria-label=${launcherLabel}
        aria-expanded=${this.panelOpen}
        aria-controls=${this.panelOpen ? "capture-options" : nothing}
        ?data-active=${active}
        ?disabled=${busy || reviewing}
        @click=${() => {
          this.panelOpen = !this.panelOpen;
        }}
      >
        <buddy-avatar
          agent-id="sonda"
          color="violet"
          style=${styleMap({ "--buddy-avatar-color": this.botColor })}
          shape="blob"
          probe-hat
          .eyeColor=${this.botEyeColor}
          .sizePx=${66}
          .isRunning=${active}
          .isFollowingPointer=${true}
          aria-hidden="true"
        ></buddy-avatar>
      </button>
      ${reviewing ? this.renderReviewDialog() : nothing}
    `;
  }
}

declare global {
  interface HTMLElementEventMap extends SondaEventMap {}
}
