import type { CaptureResult } from "./types.js";

export const captureDpr = (
  width: number,
  height: number,
  dpr: number,
  pixelBudget = 8_000_000,
): number => {
  return Math.max(
    0.1,
    Math.min(Math.max(1, dpr), 2, Math.sqrt(pixelBudget / Math.max(1, width * height))),
  );
};

const waitForAssets = async (): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ready = Promise.all([
    document.fonts?.ready,
    ...Array.from(document.images)
      .filter((image) => {
        const rect = image.getBoundingClientRect();
        return (
          rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth
        );
      })
      .map((image) =>
        image.complete ? Promise.resolve() : image.decode?.().catch(() => undefined),
      ),
  ]);
  try {
    await Promise.race([
      ready,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 1500);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

export const captureViewport = async (): Promise<CaptureResult> => {
  await waitForAssets();
  const { snapdom } = await import("@zumer/snapdom");
  const width = document.documentElement.clientWidth || innerWidth;
  const height = document.documentElement.clientHeight || innerHeight;
  const capturedAt = Date.now();
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  // WebKit renders an <html> root blank inside SnapDOM's SVG foreignObject.
  // A <body> root preserves page content and supports viewport clipping as well.
  const result = await snapdom(document.body, {
    clip: "viewport",
    exclude: ["[data-sonda-widget]"],
    excludeMode: "remove",
    scale: 1,
    dpr: captureDpr(width, height, devicePixelRatio || 1),
    embedFonts: "auto",
  });
  const canvas = await result.toCanvas();
  return {
    canvas,
    metadata: {
      width,
      height,
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
      capturedAt,
      scrollX,
      scrollY,
      warnings: result.warnings.map((warning) => warning.message),
    },
  };
};
