/** Body shape catalog and public SVG outlines. */
import { blobArtworkPath } from "./artwork.js";
import {
  archPath,
  beanPath,
  circleRing,
  circleUnionPath,
  createShapeGeometry,
  cylinderPath,
  domePath,
  eggPath,
  horizontalCapsulePath,
  leafPath,
  pebblePath,
  regularPolygonPath,
  ringPath,
  roundedPolygonPath,
  shieldPath,
  superellipsePath,
  teardropPath,
  verticalCapsulePath,
} from "./geometry.js";
import { bodyCenter } from "./math.js";
import type { ShapeGeometry } from "./types.js";

export const shapeGeometry: Record<string, ShapeGeometry> = {
  blob: createShapeGeometry("Blob", blobArtworkPath),
  pebble: createShapeGeometry("Pebble", pebblePath(108, 0.075, 1.1)),
  bean: createShapeGeometry("Bean", beanPath(94, 112, 0.34, Math.PI), {
    solid: [
      [-16.8, -102, 0, 42],
      [-13.5, -84, 0, 62],
      [-8.5, -60, 0, 78],
      [-3, -36, 0, 84],
      [1.5, -12, 0, 85],
      [1.5, 12, 0, 85],
      [-3, 36, 0, 84],
      [-8.5, 60, 0, 78],
      [-13.5, 84, 0, 62],
      [-16.8, 102, 0, 42],
    ],
  }),
  egg: createShapeGeometry("Egg", eggPath(98, 113, 0.22)),
  squircle: createShapeGeometry("Squircle", superellipsePath(107, 107, 4.2)),
  tablet: createShapeGeometry("Tablet", horizontalCapsulePath(114, 74), {
    solid: [
      [-40, 0, 0, 74],
      [-26.7, 0, 0, 74],
      [-13.3, 0, 0, 74],
      [0, 0, 0, 74],
      [13.3, 0, 0, 74],
      [26.7, 0, 0, 74],
      [40, 0, 0, 74],
    ],
  }),
  capsule: createShapeGeometry("Capsule", verticalCapsulePath(72, 113)),
  cylinder: createShapeGeometry("Cylinder", cylinderPath(94, 110, 34), { tiltScale: 0.45 }),
  hex: createShapeGeometry("Hex", regularPolygonPath(114, 6, 20, Math.PI / 6)),
  gem: createShapeGeometry("Gem", superellipsePath(112, 113, 1.5)),
  crystal: createShapeGeometry(
    "Crystal",
    roundedPolygonPath(
      [
        [bodyCenter, bodyCenter - 113],
        [bodyCenter + 76, bodyCenter - 52],
        [bodyCenter + 76, bodyCenter + 52],
        [bodyCenter, bodyCenter + 113],
        [bodyCenter - 76, bodyCenter + 52],
        [bodyCenter - 76, bodyCenter - 52],
      ],
      [20, 26],
    ),
  ),
  wedge: createShapeGeometry("Wedge", regularPolygonPath(130, 3, 60, -Math.PI / 2)),
  shield: createShapeGeometry("Shield", shieldPath(98, 108, 30)),
  dome: createShapeGeometry("Dome", domePath(114, 82, 26)),
  arch: createShapeGeometry("Arch", archPath(76, 113, 20)),
  cloud: createShapeGeometry(
    "Cloud",
    circleUnionPath([
      [bodyCenter - 62, bodyCenter + 26, 56],
      [bodyCenter + 62, bodyCenter + 26, 54],
      [bodyCenter, bodyCenter + 34, 62],
      [bodyCenter - 24, bodyCenter - 30, 62],
      [bodyCenter + 38, bodyCenter - 26, 54],
    ]),
    {
      solid: [
        [-62, 26, 10, 58],
        [62, 26, -14, 56],
        [0, 34, 24, 64],
        [-24, -30, -22, 64],
        [38, -26, 16, 56],
      ],
    },
  ),
  teardrop: createShapeGeometry(
    "Teardrop",
    teardropPath(88, bodyCenter - 114, bodyCenter + 26, 18),
  ),
  leaf: createShapeGeometry("Leaf", leafPath(88, 113, 1.5)),
};

shapeGeometry.wedge.face.leftDX = -6;

export const circleOutlinePath = ringPath(circleRing);

export const shapePaths = Object.fromEntries(
  Object.entries(shapeGeometry).map(([name, shape]) => [name, shape.path]),
);

export const circlePath = circleOutlinePath;
