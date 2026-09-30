/** Buddy: a Lit avatar backed by the SVG animation engine. */
import { LitElement, css, html, nothing, svg, type PropertyValues } from "lit";
import {
  createBuddyEngine,
  shapePaths,
  circlePath,
  type BuddyEngine,
  type BuddyEngineConfig,
  type BuddyAvatarState,
} from "./engine/index.js";

export type { BuddyAvatarState } from "./engine/index.js";

export type PersonaState = BuddyAvatarState;

export interface BuddyAvatarProps {
  currentActivity?: unknown | null;
  isRunning?: boolean;
  isComposingMessage?: boolean;
  awaitingUserResponse?: unknown | null;
}

const COLORS: Record<string, { light: string; dark: string }> = {
  black: { light: "#000000", dark: "#FFFFFF" },
  brown: { light: "#A27952", dark: "#855C36" },
  red: { light: "#FF3E51", dark: "#E02135" },
  orange: { light: "#FF781C", dark: "#FF6700" },
  yellow: { light: "#FFAF38", dark: "#FF9800" },
  green: { light: "#00C972", dark: "#009957" },
  cyan: { light: "#1CC3B0", dark: "#00A592" },
  blue: { light: "#2A92FE", dark: "#0E74E0" },
  violet: { light: "#A97EFE", dark: "#804EE0" },
  magenta: { light: "#FF5EB1", dark: "#E02A88" },
  gray: { light: "#959595", dark: "#777777" },
};

// @evidence src/app/dist/renderer/assets/index-UbX-y3il.js#byteOffset=1412620
// Eee/Cee's deterministic fallback selectors, kept artifact-exact.
const SHIPPED_SHAPES = [
  "blob",
  "pebble",
  "squircle",
  "tablet",
  "wedge",
  "hex",
  "cloud",
  "teardrop",
] as const;

const SHIPPED_COLORS = [
  "brown",
  "red",
  "orange",
  "yellow",
  "green",
  "cyan",
  "blue",
  "violet",
  "magenta",
  "gray",
] as const;

const shippedRandom = (seed: number): (() => number) => {
  let value = seed >>> 0;
  return () => {
    value = (value + 1831565813) | 0;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

const shippedHash = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
};

const shippedColorIndex = (value: string): number => {
  const seed = (shippedHash(value) ^ Math.imul(1, 2654435769)) >>> 0;
  return Math.floor(shippedRandom((seed ^ 2654435769) >>> 0)() * 10);
};

const shippedShapeHash = (value: string): number => {
  let hash = shippedHash(value);
  hash = Math.imul(hash ^ (hash >>> 16), 73244475);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  return (hash ^ (hash >>> 16)) >>> 0;
};

export const resolvePersonaColor = (agentId: string, color?: string | null): string => {
  if (color != null && COLORS[color] != null) return color;
  return SHIPPED_COLORS[shippedColorIndex(agentId)] ?? "gray";
};

export const resolvePersonaShape = (agentId: string, shape?: string | null): string => {
  if (shape != null && Object.hasOwn(shapePaths, shape)) return shape;
  return SHIPPED_SHAPES[shippedShapeHash(agentId) % SHIPPED_SHAPES.length] ?? "blob";
};

export const PERSONA_SHAPE_PATHS = shapePaths;
export const personaShapePath = (shape: string): string => shapePaths[shape] ?? shapePaths.blob;

const ACTIVITY_TO_STATE: Record<string, PersonaState> = {
  thinking: "thinking",
  searching: "searching",
  browsing: "searching",
  reading: "searching",
  connecting: "searching",
  writing: "working",
  coding: "working",
  generating: "loading",
  "running-commands": "working",
  "on-its-computer": "working",
  "on-your-computer": "working",
  working: "working",
  messaging: "orbit",
  waiting: "orbit",
  sending: "sending",
};

// Shipped dse/Xon connector activities use the searching animation.
const CONNECTOR_TOOLS = new Set([
  "CallMcpTool",
  "GetMcpTools",
  "McpAuth",
  "SearchPlugins",
  "GetPlugin",
  "InstallPlugin",
  "UninstallPlugin",
  "GetMcpServerStatus",
  "AddMcpServer",
  "UninstallMcpServer",
  "AuthenticateMcpServer",
  "RestartMcpServers",
  "SetMcpInstructions",
  "SearchMcpServers",
  "InstallMcpServer",
  "EnableTeamServer",
]);

const activityState = (activity: unknown): PersonaState | null => {
  if (typeof activity !== "object" || activity == null) return null;
  const value = activity as Record<string, unknown>;
  if (value.kind === "thinking") return "thinking";
  if (value.kind === "tool" && value.tool === "SendToAgent") return "sending";
  if (typeof value.verb === "string" && ACTIVITY_TO_STATE[value.verb] != null) {
    return ACTIVITY_TO_STATE[value.verb];
  }
  if (typeof value.tool === "string") {
    if (CONNECTOR_TOOLS.has(value.tool)) return "searching";
    if (value.tool === "WebSearch") return "searching";
    if (
      ["WebFetch", "Read", "ExternalRead", "BoxRead"].includes(value.tool) ||
      value.tool.startsWith("browser_")
    )
      return "searching";
    if (value.tool === "GenerateImage") return "loading";
    if (["SendToAgent", "UpdateAgent", "CreateAgent", "ReactToMessage"].includes(value.tool))
      return "orbit";
    if (
      [
        "Task",
        "Await",
        "CheckSubagent",
        "MessageSubagent",
        "StopSubagent",
        "AwaitShell",
        "AwaitExternalShell",
      ].includes(value.tool)
    )
      return "orbit";
    return "working";
  }
  return null;
};

/** Mirrors the shipped mct/wbe state gate using the current typed roster inputs. */
export const personaStateFromAgent = (input: BuddyAvatarProps): PersonaState => {
  if (input.awaitingUserResponse != null) return "idle";
  if (input.isComposingMessage === true) return "thinking";
  if (input.isRunning !== true) return "idle";
  return activityState(input.currentActivity) ?? "working";
};

const DEFAULT_SIZE_PX = 36;
const DEFAULT_EYE_COLOR = "var(--buddy-avatar-eye-color, var(--cursor-bg-editor, #fff))";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
// Shipped sd wrapper: rnt/int/ant/ont/c4e, renderer byte offset 1105441.
const SHAPE_SCALE: Record<string, number> = {
  blob: 0.92,
  pebble: 0.96,
  squircle: 0.84,
  tablet: 1,
  wedge: 0.94,
  hex: 0.94,
  cloud: 1,
  teardrop: 1,
};
const INDICES = [0, 1, 2, 3, 4, 5, 6];
type GazePosition = { x: number; y: number };
let nextId = 0;

export class BuddyAvatar extends LitElement {
  static properties = {
    agentId: { type: String, attribute: "agent-id" },
    color: { type: String },
    shape: { type: String },
    sizePx: { type: Number, attribute: "size-px" },
    state: { type: String },
    isRunning: { type: Boolean, attribute: "is-running" },
    isComposingMessage: { type: Boolean, attribute: "is-composing-message" },
    currentActivity: { attribute: false },
    awaitingUserResponse: { attribute: false },
    paused: { type: Boolean },
    isStatic: { type: Boolean, attribute: "is-static" },
    isFollowingPointer: { type: Boolean, attribute: "is-following-pointer" },
    followTarget: { attribute: false },
    emphasis: { type: Boolean },
    spinSignal: { type: Number, attribute: "spin-signal" },
    eyeColor: { type: String, attribute: "eye-color" },
    probeHat: { type: Boolean, attribute: "probe-hat" },
  };

  static styles = css`
    :host {
      display: inline-block;
      line-height: 0;
      vertical-align: middle;
    }
    svg {
      display: block;
      overflow: visible;
      user-select: none;
      -webkit-user-select: none;
      transform-origin: 50% 50%;
    }
    [part="body"],
    .silhouette,
    .particle {
      fill: var(--fg);
    }
    #eyes {
      fill: var(--bg);
    }
    [part="probe-hat"] {
      --hat-ink: color-mix(in srgb, var(--fg), #000 42%);
      fill: var(--fg);
      stroke: var(--hat-ink);
      stroke-width: 5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .probe-dish {
      fill: var(--bg);
    }
    .probe-tip {
      fill: var(--hat-ink);
      stroke: none;
    }
  `;

  // Declare + constructor assignments avoid shadowing Lit's reactive accessors.
  declare agentId: string;
  declare color: string | undefined;
  declare shape: string | undefined;
  declare sizePx: number;
  declare state: BuddyAvatarState | undefined;
  declare isRunning: boolean;
  declare isComposingMessage: boolean;
  declare currentActivity: unknown | null;
  declare awaitingUserResponse: unknown | null;
  declare paused: boolean;
  declare isStatic: boolean;
  declare isFollowingPointer: boolean;
  declare followTarget: GazePosition | null;
  declare emphasis: boolean;
  declare spinSignal: number;
  declare eyeColor: string;
  declare probeHat: boolean;

  private readonly clipId = `buddy-avatar-${nextId++}`;
  private engine: BuddyEngine | null = null;
  private config: BuddyEngineConfig | null = null;
  private pointer: GazePosition | null = null;
  private media: MediaQueryList | null = null;
  private motionReduced = false;

  constructor() {
    super();
    this.agentId = "buddy";
    this.color = undefined;
    this.shape = undefined;
    this.state = undefined;
    this.sizePx = DEFAULT_SIZE_PX;
    this.isRunning = false;
    this.isComposingMessage = false;
    this.currentActivity = null;
    this.awaitingUserResponse = null;
    this.paused = false;
    this.isStatic = false;
    this.isFollowingPointer = false;
    this.followTarget = null;
    this.emphasis = false;
    this.spinSignal = 0;
    this.eyeColor = DEFAULT_EYE_COLOR;
    this.probeHat = false;
  }

  get resolvedState(): BuddyAvatarState {
    return this.state ?? personaStateFromAgent(this);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.media = this.ownerDocument.defaultView?.matchMedia(REDUCED_MOTION_QUERY) ?? null;
    this.motionReduced = this.media?.matches ?? false;
    this.media?.addEventListener("change", this.onMotionChange);
    this.ownerDocument.defaultView?.addEventListener("pointermove", this.onPointerMove, {
      passive: true,
    });
    this.ownerDocument.documentElement.addEventListener("pointerleave", this.clearGaze);
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    this.disposeEngine();
    this.pointer = null;
    this.media?.removeEventListener("change", this.onMotionChange);
    this.media = null;
    this.ownerDocument.defaultView?.removeEventListener("pointermove", this.onPointerMove);
    this.ownerDocument.documentElement.removeEventListener("pointerleave", this.clearGaze);
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (!this.isConnected) return;
    const shape = resolvePersonaShape(this.agentId, this.shape);
    const scale = SHAPE_SCALE[shape] ?? 1;
    const now = this.ownerDocument.defaultView!.performance.now();
    if (!this.config) {
      this.config = {
        id: this.clipId,
        state: this.resolvedState,
        changedAt: now,
        shape,
        paused: this.paused || this.isStatic || this.motionReduced,
        reducedMotion: this.motionReduced,
        gazeTarget: null,
        emphasis: this.emphasis,
        badgeColor: "var(--gb-badge, #1d9bf0)",
        pose: { turn: 17, tilt: -14, roll: 29, scale: (scale * 259) / 229 },
        poseHome: { turn: 33, tilt: -19, roll: 38 },
        faceTune: { size: 0.86, gap: 1.18, height: 1, eyeWidth: 0.96, eyeHeight: 0.92 },
        eyeTopology: true,
        uniformEyes: true,
        eyeScale: 0.92 / scale,
      };
    } else {
      if (this.config.state !== this.resolvedState) this.config.changedAt = now;
      Object.assign(this.config, {
        state: this.resolvedState,
        shape,
        paused: this.paused || this.isStatic || this.motionReduced,
        emphasis: this.emphasis,
        eyeScale: 0.92 / scale,
      });
      this.config.pose.scale = (scale * 259) / 229;
    }
    if (changed.has("isFollowingPointer") && !this.isFollowingPointer) this.pointer = null;
    this.updateGaze();
    if (!this.engine) {
      const node = <T extends SVGElement>(selector: string) =>
        this.renderRoot.querySelector<T>(selector)!;
      const nodes = <T extends SVGElement>(selector: string) =>
        Array.from(this.renderRoot.querySelectorAll<T>(selector));
      this.engine = createBuddyEngine(
        {
          svg: node<SVGSVGElement>("svg"),
          face: node<SVGGElement>("#face"),
          back: node<SVGGElement>("#particles-back"),
          front: node<SVGGElement>("#particles-front"),
          body: node<SVGPathElement>('[part="body"]'),
          clip: node<SVGPathElement>("clipPath path"),
          eyes: nodes<SVGPathElement>("#eyes path"),
          silhouettes: nodes<SVGPathElement>(".silhouette"),
          rings: nodes<SVGCircleElement>(".ring"),
          parts: nodes<SVGCircleElement>(".particle"),
          glyphs: nodes<SVGPathElement>(".glyph"),
          badge: node<SVGCircleElement>("#badge"),
        },
        this.config,
      );
    } else {
      this.engine.resume();
    }
    if (changed.has("spinSignal") && this.spinSignal > 0) this.spin();
  }

  private disposeEngine(): void {
    this.engine?.dispose();
    this.engine = null;
    this.config = null;
  }

  private onMotionChange = (event: MediaQueryListEvent): void => {
    this.motionReduced = event.matches;
    this.disposeEngine();
    this.requestUpdate();
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.isFollowingPointer) return;
    this.pointer = { x: event.clientX, y: event.clientY };
    this.updateGaze();
  };

  private clearGaze = (): void => {
    this.pointer = null;
    this.updateGaze();
  };

  private updateGaze(): void {
    if (!this.config) return;
    const target = this.isFollowingPointer ? this.pointer : this.followTarget;
    const rect = this.getBoundingClientRect();
    if (!target || !rect.width || !rect.height) {
      this.config.gazeTarget = null;
      return;
    }
    // Shipped _Fe wrapper: radial distance response, then the engine's smoothed gaze.
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = target.x - cx;
    const dy = target.y - cy;
    const strength = Math.min(1, Math.sqrt(Math.hypot(dx, dy) / (rect.width * 2)));
    const angle = Math.atan2(dy, dx);
    this.config.gazeTarget = {
      x: cx + 0.6 * (14 / 22) * strength * Math.cos(angle) * rect.width,
      y: cy + 0.6 * strength * Math.sin(angle) * rect.height,
    };
  }

  spin(turns = 1): void {
    if (!this.motionReduced && !this.paused && !this.isStatic) this.engine?.spin(turns);
  }

  bounce(): void {
    if (!this.motionReduced && !this.paused && !this.isStatic) this.engine?.bounce();
  }

  burst(): void {
    if (!this.motionReduced && !this.paused && !this.isStatic) this.engine?.burst();
  }

  protected override render() {
    const colors = COLORS[resolvePersonaColor(this.agentId, this.color)];
    const shape = resolvePersonaShape(this.agentId, this.shape);
    const path = personaShapePath(shape);
    const size = Number.isFinite(this.sizePx) && this.sizePx > 0 ? this.sizePx : DEFAULT_SIZE_PX;
    const scale = ((SHAPE_SCALE[shape] ?? 1) * 259) / 229;
    return html`
      <svg
        aria-hidden="true"
        part="svg"
        viewBox="-15 -15 259 259"
        width=${size}
        height=${size}
        data-buddy-state=${this.resolvedState}
        data-reduced-motion=${String(this.motionReduced)}
        style=${`--fg: var(--buddy-avatar-color, light-dark(${colors.light}, ${colors.dark})); --bg: ${this.eyeColor}; transform: scale(${scale})`}
      >
        <defs>
          <clipPath id=${this.clipId}><path d=${path}></path></clipPath>
        </defs>
        <g id="particles-back" aria-hidden="true"></g>
        ${INDICES.slice(0, 2).map(() => svg`<path class="silhouette" d=${circlePath} style="display:none"></path>`)}
        ${INDICES.map(() => svg`<circle class="ring" cx="114.2705" cy="114.2705" r="0" fill="none" style="display:none;stroke:var(--fg)"></circle>`)}
        ${INDICES.map(() => svg`<circle class="particle" cx="114.2705" cy="114.2705" r="0" style="display:none"></circle>`)}
        ${INDICES.slice(0, 3).map(() => svg`<path class="glyph" style="display:none"></path>`)}
        <g id="face">
          <path part="body" d=${path}></path>
          ${
            this.probeHat
              ? svg`
                <g part="probe-hat" transform="translate(126 7)" aria-hidden="true">
                  <path d="M-15 7Q0-1 15 7M0 3V-13" fill="none"></path>
                  <g transform="translate(0 -25) rotate(28)">
                    <path d="M-35 0C-27 30 27 30 35 0Z"></path>
                    <ellipse class="probe-dish" rx="35" ry="10"></ellipse>
                    <path d="M0 0V-27" fill="none"></path>
                    <circle class="probe-tip" cy="-29" r="6"></circle>
                  </g>
                </g>
              `
              : nothing
          }
          <g id="eyes" part="eyes" clip-path=${`url(#${this.clipId})`}>
            <path></path>
            <path></path>
          </g>
          <circle
            id="badge"
            cx="114.2705"
            cy="114.2705"
            r="0"
            style="display:none;stroke:var(--bg);stroke-width:6"
          ></circle>
        </g>
        <g id="particles-front" aria-hidden="true"></g>
      </svg>
    `;
  }
}

/** Explicit registration keeps importing the class free of registry side effects. */
export const defineBuddyAvatar = (tagName = "buddy-avatar"): void => {
  if (!customElements.get(tagName)) customElements.define(tagName, BuddyAvatar);
};

declare global {
  interface HTMLElementTagNameMap {
    "buddy-avatar": BuddyAvatar;
  }
}
