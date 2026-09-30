/** Shared contracts for the Buddy avatar and animation engine. */

export type BuddyAvatarState =
  | "sleeping"
  | "waking"
  | "idle"
  | "listening"
  | "thinking"
  | "searching"
  | "working"
  | "excited"
  | "surprised"
  | "suspicious"
  | "angry"
  | "drowsy"
  | "happy"
  | "curious"
  | "confused"
  | "bored"
  | "proud"
  | "shy"
  | "sad"
  | "laughing"
  | "scared"
  | "playful"
  | "celebrate"
  | "orbit"
  | "radar"
  | "progress"
  | "spawning"
  | "humming"
  | "loading"
  | "dictating"
  | "writing"
  | "sending"
  | "receiving"
  | "uploading"
  | "notifying"
  | "alerting"
  | "dragging"
  | "bouncing"
  | "powering-down";

export interface BuddyEngineConfig {
  id: string;
  state: BuddyAvatarState;
  changedAt: number;
  shape: string;
  paused: boolean;
  reducedMotion: boolean;
  gazeTarget: { x: number; y: number } | null;
  emphasis: boolean;
  badgeColor: string;
  pose: { turn: number; tilt: number; roll: number; scale: number };
  poseHome: { turn: number; tilt: number; roll: number };
  faceTune: { size: number; gap: number; height: number; eyeWidth: number; eyeHeight: number };
  eyeTopology: boolean;
  uniformEyes: boolean;
  eyeScale: number;
}

export interface BuddyEngine {
  spin(turns?: number): void;
  bounce(): void;
  burst(): void;
  resume(): void;
  readonly running: boolean;
  dispose(): void;
}

export interface BuddyEngineNodes {
  svg: SVGSVGElement;
  face: SVGGElement;
  back: SVGGElement;
  front: SVGGElement;
  body: SVGPathElement;
  clip: SVGPathElement;
  eyes: SVGPathElement[];
  silhouettes: SVGPathElement[];
  rings: SVGCircleElement[];
  parts: SVGCircleElement[];
  glyphs: SVGPathElement[];
  badge: SVGCircleElement;
}

export type Point = [number, number];

export type Circle = [number, number, number];

export type SolidSphere = [number, number, number, number];

export interface Spring {
  x: number;
  v: number;
  t: number;
}

export interface FaceFit {
  x: number;
  y: number;
  sx: number;
  sy: number;
  eye: number;
  leftDX?: number;
}

export interface ShapeOptions {
  solid?: SolidSphere[];
  tiltScale?: number;
  sides?: number;
}

export interface ShapeGeometry {
  label: string;
  path: string;
  radius: number;
  beltRadius: number;
  tiltScale: number;
  face: FaceFit;
  spanAt: (y: number) => Point;
  ring: Point[];
  sides: number;
  turnAt: ((angle: number) => Point[]) | null;
  top: number;
  bottom: number;
  solid?: SolidSphere[];
}

export type MorphName =
  | "dots"
  | "orbit"
  | "radar"
  | "progress"
  | "gather"
  | "wave"
  | "send"
  | "receive"
  | "dock"
  | "ball"
  | "whirl"
  | "pencil"
  | "bang"
  | "standby";

export interface BlinkEvent {
  at: number;
  v: number;
}

export interface SpecialSpin {
  kind: "spinDizzy" | "spinWild" | "spinBounce";
  t0: number;
  dir: number;
  turns: number;
}

export interface Orbit {
  lam: number;
  lamVel: number;
  tilt: number;
  roll: number;
  rad: number;
  radVel: number;
  follow: number;
  carry: number;
  arc: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  z: number;
  l: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  rot: number;
  vr: number;
  curl: number;
  color: string;
  round: boolean;
  star: boolean;
  ret: number;
  orbit: Orbit | null;
  el: SVGElement | null;
  hue?: number;
  hueSpan?: number;
  hueVel?: number;
  hist?: TrailPoint[];
  trailEl?: SVGPathElement;
  trailFrontEl?: SVGPathElement;
  gradEl?: SVGLinearGradientElement;
  stops?: SVGStopElement[];
}

export interface ParticleFrame {
  sizeScale: number;
  spinAngle: number;
  wideStyle: boolean;
  sustainBelts: boolean;
}

export interface ParticleSystemOptions {
  back: SVGGElement;
  front: SVGGElement;
  idPrefix: string;
  reduceMotion: boolean;
  radius: () => number;
}
