// Preserve the reference engine's short-circuit and comma expression evaluation order.
/* oxlint-disable no-unused-expressions */
/** Fixed-step spring integration. */
import type { Spring } from "./types.js";

export const createSpring = (initial: number) => ({ x: initial, v: 0, t: initial });

export const stepSpring = (spring: Spring, frequency: number, damping: number, delta: number) => {
  spring.v +=
    (-2 * damping * frequency * spring.v - frequency * frequency * (spring.x - spring.t)) * delta;
  spring.x += spring.v * delta;
  (!Number.isFinite(spring.x) || !Number.isFinite(spring.v)) &&
    ((spring.x = spring.t), (spring.v = 0));
};

const springTimeStep = 1 / 120;

export const springSubstepCount = (delta: number) => Math.max(1, Math.ceil(delta / springTimeStep));
