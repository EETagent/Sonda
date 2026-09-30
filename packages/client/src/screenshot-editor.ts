import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { keyed } from "lit/directives/keyed.js";
import {
  AnnotationHistory,
  TEXT_LINE_HEIGHT,
  annotationBounds,
  hitTest,
  toImagePoint,
  translateAnnotation,
} from "./annotations.js";
import type {
  Annotation,
  AnnotationDocument,
  Point,
  StrokeAnnotation,
  TextAnnotation,
} from "./annotations.js";
import { renderAnnotations } from "./renderer.js";
import type { CaptureResult } from "./types.js";
import { icon } from "./icons.js";
import { screenshotEditorStyles } from "./screenshot-editor-styles.js";

type Tool = "pen" | "text" | "select";
const tools: Array<{ id: Tool; label: string; description: string; shortcut: string }> = [
  { id: "select", label: "Select", description: "Select and move", shortcut: "V" },
  { id: "pen", label: "Draw", description: "Draw", shortcut: "D" },
  { id: "text", label: "Text", description: "Add text", shortcut: "T" },
];
const colors = [
  { value: "#e5534b", label: "Red" },
  { value: "#f3a83b", label: "Amber" },
  { value: "#3867e8", label: "Blue" },
  { value: "#58a45a", label: "Green" },
  { value: "#222b26", label: "Ink" },
  { value: "#ffffff", label: "White" },
];

interface PointerGesture {
  id: number;
  start: Point;
  stroke?: StrokeAnnotation;
  item?: Annotation;
  draft?: Annotation;
  target: HTMLElement;
}

export class ScreenshotEditor extends LitElement {
  static properties = {
    capture: { attribute: false },
    disabled: { type: Boolean },
    tool: { state: true },
    color: { state: true },
    width: { state: true },
    fontSize: { state: true },
    selected: { state: true },
    editId: { state: true },
    scale: { state: true },
  };
  declare capture: CaptureResult;
  declare disabled: boolean;
  declare private tool: Tool;
  declare private color: string;
  declare private width: number;
  declare private fontSize: number;
  declare private selected: string | undefined;
  declare private editId: string | undefined;
  declare private scale: number;
  private history = new AnnotationHistory();
  private textDraft = "";
  private editing?: TextAnnotation;
  private observer?: ResizeObserver;
  private frame = 0;
  private pointer?: PointerGesture;

  static styles = screenshotEditorStyles;

  constructor() {
    super();
    this.disabled = false;
    this.tool = "pen";
    this.color = colors[0].value;
    this.width = 4;
    this.fontSize = 24;
    this.scale = 1;
  }
  connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.observeSize();
  }

  protected firstUpdated(): void {
    this.observeSize();
  }

  private observeSize(): void {
    this.observer ??= new ResizeObserver(() => this.resize());
    this.observer.observe(this);
    const workspace = this.renderRoot.querySelector(".workspace");
    if (workspace) this.observer.observe(workspace);
    this.resize();
  }
  protected updated(changed: PropertyValues): void {
    if (changed.has("capture") && this.capture) {
      this.cancelPointer();
      this.editing = undefined;
      this.textDraft = "";
      this.history.reset();
      this.selected = undefined;
      this.editId = undefined;
      this.resize();
    }
    this.schedulePaint();
  }
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer?.disconnect();
    this.observer = undefined;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.cancelPointer();
    for (const canvas of this.renderRoot.querySelectorAll("canvas"))
      canvas.width = canvas.height = 0;
  }
  getDocument(): AnnotationDocument {
    this.commitText();
    this.finishPointer();
    return {
      schemaVersion: 1,
      width: this.capture.metadata.width,
      height: this.capture.metadata.height,
      items: structuredClone(this.history.items),
    };
  }
  private resize(): void {
    if (!this.capture || !this.isConnected) return;
    const workspace = this.renderRoot.querySelector<HTMLElement>(".workspace");
    const stage = this.renderRoot.querySelector<HTMLElement>(".stage");
    if (!workspace || !stage) return;
    const { width, height } = this.capture.metadata;
    const padding = getComputedStyle(workspace);
    const availableWidth =
      workspace.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight);
    const availableHeight =
      workspace.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom);
    this.scale = Math.max(0.02, Math.min(availableWidth / width, availableHeight / height, 1));
    stage.style.width = `${width * this.scale}px`;
    stage.style.height = `${height * this.scale}px`;
    const base = this.renderRoot.querySelector<HTMLCanvasElement>("#base");
    if (!base) return;
    base.width = this.capture.canvas.width;
    base.height = this.capture.canvas.height;
    base.getContext("2d")?.drawImage(this.capture.canvas, 0, 0);
    this.schedulePaint();
  }
  private schedulePaint(): void {
    if (this.frame || !this.isConnected) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.paint();
    });
  }
  private paint(): void {
    const canvas = this.renderRoot.querySelector<HTMLCanvasElement>("#ink");
    if (!canvas || !this.capture) return;
    const { width, height } = this.capture.metadata;
    const ratio = this.scale * Math.min(devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(width * ratio));
    const pixelHeight = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
    ctx.clearRect(0, 0, width, height);
    let items = this.history.items.filter((item) => item.id !== this.editId);
    const draft = this.pointer?.draft;
    if (draft) items = items.map((item) => (item.id === draft.id ? draft : item));
    if (this.pointer?.stroke) items = [...items, this.pointer.stroke];
    renderAnnotations(ctx, items);
    const selected = items.find((item) => item.id === this.selected);
    if (selected && !this.editId) {
      const bounds = annotationBounds(selected);
      ctx.strokeStyle = "#7962c4";
      ctx.lineWidth = 1.5 / this.scale;
      ctx.setLineDash([4 / this.scale, 3 / this.scale]);
      ctx.strokeRect(bounds.x - 3, bounds.y - 3, bounds.width + 6, bounds.height + 6);
      ctx.setLineDash([]);
    }
  }
  private point(event: PointerEvent): Point {
    return toImagePoint(
      event.clientX,
      event.clientY,
      this.renderRoot.querySelector("#ink")!.getBoundingClientRect(),
      this.capture.metadata.width,
      this.capture.metadata.height,
    );
  }
  private down(event: PointerEvent, forcedItem?: Annotation): void {
    if (this.disabled || this.pointer || event.button !== 0 || !event.isPrimary) return;
    this.commitText();
    const point = this.point(event);
    if (this.tool === "text" && !forcedItem) {
      // Keep the browser from focusing the canvas after the text field opens.
      event.preventDefault();
      const hit = hitTest(this.history.items, point, 8 / this.scale);
      void this.editText(
        hit?.kind === "text"
          ? hit
          : {
              id: crypto.randomUUID(),
              kind: "text",
              x: point.x,
              y: point.y,
              text: "",
              color: this.color,
              fontSize: this.fontSize,
            },
      );
      return;
    }
    const target = event.currentTarget as HTMLElement;
    target.focus({ preventScroll: true });
    target.setPointerCapture(event.pointerId);
    if (this.tool === "pen" && !forcedItem) {
      this.selected = undefined;
      this.pointer = {
        id: event.pointerId,
        start: point,
        target,
        stroke: {
          id: crypto.randomUUID(),
          kind: "stroke",
          color: this.color,
          width: this.width,
          points: [point],
        },
      };
    } else {
      const item = forcedItem ?? hitTest(this.history.items, point, 8 / this.scale);
      this.selected = item?.id;
      this.pointer = { id: event.pointerId, start: point, target, item, draft: item };
    }
    event.preventDefault();
    this.schedulePaint();
  }
  private move(event: PointerEvent): void {
    if (!this.pointer || event.pointerId !== this.pointer.id) return;
    if (this.pointer.stroke) {
      const samples = event.getCoalescedEvents?.() || [];
      for (const sample of samples.length ? samples : [event])
        this.pointer.stroke.points.push(this.point(sample));
    } else if (this.pointer.item) {
      const point = this.point(event);
      this.pointer.draft = translateAnnotation(
        this.pointer.item,
        point.x - this.pointer.start.x,
        point.y - this.pointer.start.y,
      );
    }
    this.schedulePaint();
  }
  private up(event: PointerEvent): void {
    if (this.pointer?.id !== event.pointerId) return;
    this.move(event);
    this.finishPointer();
  }
  private finishPointer(): void {
    const gesture = this.pointer;
    if (!gesture) return;
    this.pointer = undefined;
    if (gesture.stroke) this.history.commit([...this.history.items, gesture.stroke]);
    else if (gesture.draft) {
      const draft = gesture.draft;
      this.history.commit(this.history.items.map((item) => (item.id === draft.id ? draft : item)));
    }
    if (gesture.target.hasPointerCapture(gesture.id))
      gesture.target.releasePointerCapture(gesture.id);
    this.requestUpdate();
    this.schedulePaint();
  }
  private cancelPointer(): void {
    const gesture = this.pointer;
    this.pointer = undefined;
    if (gesture?.target.hasPointerCapture(gesture.id))
      gesture.target.releasePointerCapture(gesture.id);
    this.requestUpdate();
    this.schedulePaint();
  }
  private async editText(item: TextAnnotation): Promise<void> {
    this.editing = structuredClone(item);
    this.selected = item.id;
    this.editId = item.id;
    this.textDraft = item.text;
    await this.updateComplete;
    const input = this.renderRoot.querySelector<HTMLTextAreaElement>("textarea");
    input?.focus();
    input?.select();
  }
  private commitText(): void {
    if (!this.editing) return;
    const item = { ...this.editing, text: this.textDraft };
    const items = this.history.items.filter((annotation) => annotation.id !== item.id);
    if (item.text.trim()) {
      const index = this.history.items.findIndex((annotation) => annotation.id === item.id);
      items.splice(index < 0 ? items.length : index, 0, item);
    }
    this.history.commit(items);
    this.editId = undefined;
    this.editing = undefined;
    this.requestUpdate();
    this.schedulePaint();
  }
  private setTool(tool: Tool): void {
    this.commitText();
    this.tool = tool;
  }
  private undo(): void {
    this.commitText();
    this.history.undo();
    this.selected = undefined;
    this.requestUpdate();
  }
  private redo(): void {
    this.commitText();
    this.history.redo();
    this.selected = undefined;
    this.requestUpdate();
  }
  private removeSelected(): void {
    this.commitText();
    this.history.commit(this.history.items.filter((item) => item.id !== this.selected));
    this.selected = undefined;
    this.requestUpdate();
  }
  private clear(): void {
    this.commitText();
    this.history.commit([]);
    this.selected = undefined;
    this.requestUpdate();
  }
  private keydown(event: KeyboardEvent): void {
    if (
      this.disabled ||
      event
        .composedPath()
        .some(
          (node) =>
            node instanceof HTMLTextAreaElement ||
            node instanceof HTMLInputElement ||
            node instanceof HTMLSelectElement,
        )
    )
      return;
    if (!event.metaKey && !event.ctrlKey && !event.altKey) {
      const tool = tools.find((item) => item.shortcut.toLowerCase() === event.key.toLowerCase());
      if (tool) {
        event.preventDefault();
        this.setTool(tool.id);
        return;
      }
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      this.redo();
    } else if (this.selected && ["Delete", "Backspace"].includes(event.key)) {
      event.preventDefault();
      this.removeSelected();
    } else if (
      this.selected &&
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
    ) {
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      this.history.commit(
        this.history.items.map((item) =>
          item.id === this.selected ? translateAnnotation(item, dx, dy) : item,
        ),
      );
      this.requestUpdate();
    }
  }
  private editOnDoubleClick(event: MouseEvent): void {
    if (this.disabled) return;
    const point = toImagePoint(
      event.clientX,
      event.clientY,
      (event.currentTarget as HTMLElement).getBoundingClientRect(),
      this.capture.metadata.width,
      this.capture.metadata.height,
    );
    const item = hitTest(this.history.items, point);
    if (item?.kind === "text") void this.editText(item);
  }

  private updateText(event: Event): void {
    this.textDraft = (event.currentTarget as HTMLTextAreaElement).value;
    this.requestUpdate();
  }

  private textKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      this.editing = undefined;
      this.editId = undefined;
      this.requestUpdate();
      this.schedulePaint();
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.commitText();
    }
  }

  private renderTextEditor() {
    const editing = this.editing;
    if (!editing) return nothing;
    const stageWidth = this.capture.metadata.width * this.scale;
    const width = Math.min(400, stageWidth);
    const lineCount = this.textDraft.split("\n").length + 1;
    return html`
      <textarea
        aria-label="Annotation text"
        wrap="off"
        spellcheck="false"
        .value=${this.textDraft}
        style=${styleMap({
          left: `${Math.max(0, Math.min(editing.x * this.scale, stageWidth - width))}px`,
          top: `${editing.y * this.scale}px`,
          fontSize: `${editing.fontSize * this.scale}px`,
          color: editing.color,
          width: `${width}px`,
          height: `${Math.max(44, lineCount * editing.fontSize * TEXT_LINE_HEIGHT * this.scale)}px`,
        })}
        @input=${this.updateText}
        @blur=${this.commitText}
        @keydown=${this.textKeydown}
      ></textarea>
    `;
  }

  private renderSelectionActions(selected?: Annotation) {
    if (!selected || this.editing || this.disabled) return nothing;
    const bounds = annotationBounds(selected);
    const left = Math.max(
      0,
      Math.min(bounds.x * this.scale, this.capture.metadata.width * this.scale - 80),
    );
    const top = Math.max(0, bounds.y * this.scale - 34);
    return html`
      <div class="selection-actions" style=${styleMap({ left: `${left}px`, top: `${top}px` })}>
        <button
          class="move"
          aria-label="Move selected annotation"
          @pointerdown=${(event: PointerEvent) => this.down(event, selected)}
          @pointermove=${this.move}
          @pointerup=${this.up}
          @pointercancel=${this.cancelPointer}
          @lostpointercapture=${this.cancelPointer}
        >
          ${icon("move")}
        </button>
        ${selected.kind === "text" ? html`<button @click=${() => this.editText(selected)}>Edit text</button>` : nothing}
      </div>
    `;
  }

  private renderTools() {
    return html`
      <div class="tool-group tools" role="group" aria-label="Tools">
        ${tools.map(
          (tool) => html`
            <button
              class="tool"
              aria-label=${tool.description}
              title=${`${tool.description} (${tool.shortcut})`}
              aria-keyshortcuts=${tool.shortcut}
              aria-pressed=${this.tool === tool.id}
              ?disabled=${this.disabled}
              @click=${() => this.setTool(tool.id)}
            >
              ${icon(tool.id)}<span class="tool-label">${tool.label}</span>
            </button>
          `,
        )}
      </div>
    `;
  }

  private renderPalette() {
    return html`
      <div class="tool-group palette" role="group" aria-label="Annotation color">
        ${colors.map(
          (color) => html`
            <button
              class="swatch"
              style=${styleMap({ "--swatch-color": color.value, "--swatch-ink": ["#ffffff", "#f3a83b"].includes(color.value) ? "#292930" : "#fff" })}
              aria-label=${color.label}
              title=${color.label}
              aria-pressed=${this.color === color.value}
              ?disabled=${this.disabled}
              @click=${() => {
                this.color = color.value;
              }}
            >
              <span class="swatch-dot"
                >${this.color === color.value ? icon("check") : nothing}</span
              >
            </button>
          `,
        )}
      </div>
    `;
  }

  private changeToolSize(event: Event): void {
    const value = Number((event.currentTarget as HTMLSelectElement).value);
    if (this.tool === "text") this.fontSize = value;
    else this.width = value;
  }

  private renderToolProperties() {
    return html`
      <div class="tool-group properties">
        ${
          this.tool === "select"
            ? html`<span class="selection-hint">Drag to move</span>`
            : keyed(
                this.tool,
                html`
                  <label class="setting">
                    <span class="setting-name">${this.tool === "text" ? "Size" : "Stroke"}</span>
                    <span class="select-wrap">
                      <select
                        aria-label=${this.tool === "text" ? "Text size" : "Stroke width"}
                        .value=${String(this.tool === "text" ? this.fontSize : this.width)}
                        ?disabled=${this.disabled}
                        @change=${this.changeToolSize}
                      >
                        ${(this.tool === "text" ? [16, 24, 36] : [2, 4, 8]).map((value) => html`<option value=${value} .selected=${value === (this.tool === "text" ? this.fontSize : this.width)}>${value} px</option>`)}
                      </select>
                      ${icon("chevron")}
                    </span>
                  </label>
                `,
              )
        }
      </div>
    `;
  }

  private renderHistoryActions(selected?: Annotation) {
    return html`
      <div class="tool-group history" role="group" aria-label="Edit history">
        <button
          class="icon-button"
          aria-label="Undo"
          title="Undo (⌘/Ctrl Z)"
          ?disabled=${this.disabled || !this.history.canUndo}
          @click=${this.undo}
        >
          ${icon("undo")}
        </button>
        <button
          class="icon-button"
          aria-label="Redo"
          title="Redo (⌘/Ctrl Shift Z)"
          ?disabled=${this.disabled || !this.history.canRedo}
          @click=${this.redo}
        >
          ${icon("redo")}
        </button>
        ${
          selected
            ? html`<button
                class="icon-button"
                aria-label="Delete selected"
                title="Delete selected"
                ?disabled=${this.disabled}
                @click=${this.removeSelected}
              >
                ${icon("trash")}
              </button>`
            : nothing
        }
        <button
          class="clear-button"
          aria-label="Clear annotations"
          title="Clear annotations"
          ?disabled=${this.disabled || !this.history.items.length}
          @click=${this.clear}
        >
          Clear
        </button>
      </div>
    `;
  }

  private renderToolbar(selected?: Annotation) {
    return html`
      <div class="toolbar-area">
        <div class="toolbar" role="toolbar" aria-label="Annotation tools">
          ${this.renderTools()} ${this.renderPalette()} ${this.renderToolProperties()}
          ${this.renderHistoryActions(selected)}
        </div>
      </div>
    `;
  }

  protected render() {
    if (!this.capture) return nothing;
    const selected = this.history.items.find((item) => item.id === this.selected);
    return html`<div class="editor" @keydown=${this.keydown}>
      ${this.renderToolbar(selected)}
      <div class="workspace">
        <div class="stage">
          <canvas id="base" aria-hidden="true"></canvas
          ><canvas
            id="ink"
            tabindex="0"
            role="img"
            aria-label="Screenshot annotation canvas"
            data-tool=${this.tool}
            @pointerdown=${(e: PointerEvent) => this.down(e)}
            @pointermove=${this.move}
            @pointerup=${this.up}
            @pointercancel=${this.cancelPointer}
            @lostpointercapture=${this.cancelPointer}
            @dblclick=${this.editOnDoubleClick}
          ></canvas>
          ${this.renderTextEditor()} ${this.renderSelectionActions(selected)}
        </div>
      </div>
      <div class="help">
        <span
          >${this.tool === "pen" ? "Draw on the screenshot to highlight an issue." : this.tool === "text" ? "Click to add text. Double-click to edit." : "Select and drag. Arrow keys nudge; Delete removes."}</span
        ><span class="canvas-meta"
          ><span aria-live="polite"
            >${this.history.items.length}
            ${this.history.items.length === 1 ? "annotation" : "annotations"}</span
          ><span class="zoom">${Math.round(this.scale * 100)}%</span></span
        >
      </div>
    </div>`;
  }
}
