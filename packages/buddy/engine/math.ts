/** Numeric helpers; operation order and rounding match the reference engine. */

export const bodyCenter = 114.2705;

export const fullTurn = Math.PI * 2;

export const roundHundredth = (value: number) => Math.round(value * 100) / 100;

export const clampGeometry = (value: number, minimum: number, maximum: number) =>
  value < minimum ? minimum : value > maximum ? maximum : value;

export const randomBetween = (minimum: number, maximum: number) =>
  minimum + Math.random() * (maximum - minimum);

export const clampMotion = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export const easeInOutCubic = (progress: number) =>
  progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

export const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

export const easeOutBack = (progress: number) =>
  1 + 2.70158 * Math.pow(progress - 1, 3) + 1.70158 * Math.pow(progress - 1, 2);

export const smoothstep = (progress: number) => progress * progress * (3 - 2 * progress);

export const frameIndependentBlend = (factor: number, delta: number) =>
  1 - Math.exp(Math.log(1 - factor) * 60 * delta);
