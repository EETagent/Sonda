/** Body morphs and glyph geometry. */
import { circleRing } from "./geometry.js";
import { bodyCenter } from "./math.js";
import { shapeGeometry } from "./shapes.js";
import type { MorphName, Point } from "./types.js";

export const baseEyeHeight = 21;

export const eyeContourPadding = 5;

const svgViewBox = { minX: -15, minY: -15, width: 259, height: 259 };

export const morphNames: MorphName[] = [
  "dots",
  "orbit",
  "radar",
  "progress",
  "gather",
  "wave",
  "send",
  "receive",
  "dock",
  "ball",
  "whirl",
  "pencil",
  "bang",
  "standby",
];

export const bodyMorphThreshold = 0.62;

const rotateRingSamples = (points: Point[], shift: number): Point[] => {
  const t = points.length;
  const s = (shift / t) * Math.PI * 2;
  const r = Math.cos(s);
  const i = Math.sin(s);
  return Array.from({ length: t }, (o, l) => {
    const [c, u] = points[(((l - shift) % t) + t) % t];
    const d = c - bodyCenter;
    const m = u - bodyCenter;
    return [bodyCenter + d * r - m * i, bodyCenter + d * i + m * r];
  });
};

const pencilRing = rotateRingSamples(
  shapeGeometry.teardrop.ring,
  shapeGeometry.teardrop.ring.length / 2,
);

export const morphRing = (morph: MorphName | null) =>
  morph === "pencil" ? pencilRing : circleRing;

const morphSizeMultipliers = {
  dots: 1.5,
  orbit: 1.14,
  radar: 1.14,
  progress: 1.32,
  gather: 1.15,
  wave: 1.42,
  send: 1.12,
  receive: 1.12,
  dock: 1.3,
  ball: 1.22,
  whirl: 1.45,
  pencil: 1.18,
  bang: 1.28,
  standby: 1.75,
};

export const viewBoxHalfWidth = svgViewBox.width / 2;

export const viewBoxCenter = svgViewBox.minX + viewBoxHalfWidth;

export const dotRadius = 22;

export const dotSpacing = 62;

export const dotIdleScale = 0.84;

export const dotPulseScale = 0.22;

export const dotOutlineScale = 1.02;

export function morphZoomScale(morph: MorphName | null, size: number) {
  return morph == null ? 1 : Math.max(morphSizeMultipliers[morph] / Math.max(size, 1), 1);
}

const pillGlyphPath = (width: number, height: number) => {
  const t = width / 2;
  const s = bodyCenter - height / 2 + t;
  const r = bodyCenter + height / 2 - t;
  return `M${bodyCenter - t} ${s}A${t} ${t} 0 0 1 ${bodyCenter + t} ${s}L${bodyCenter + t} ${r}A${t} ${t} 0 0 1 ${bodyCenter - t} ${r}Z`;
};

const taperedGlyphPath = (topWidth: number, bottomWidth: number, height: number) => {
  const s = topWidth / 2;
  const r = bottomWidth / 2;
  const i = bodyCenter - height / 2;
  const o = bodyCenter + height / 2;
  return `M${bodyCenter - s} ${i + s}A${s} ${s} 0 0 1 ${bodyCenter + s} ${i + s}L${bodyCenter + r} ${o - r}A${r} ${r} 0 0 1 ${bodyCenter - r} ${o - r}Z`;
};

export const pencilGlyphPath = pillGlyphPath(30, 88);

export const alertGlyphPath = taperedGlyphPath(30, 17, 96);
