import { TEXT_LINE_HEIGHT, type Annotation, type AnnotationDocument } from "./annotations.js";

export const renderAnnotations = (
  ctx: CanvasRenderingContext2D,
  items: Array<Annotation>,
): void => {
  ctx.save();
  for (const item of items) {
    ctx.fillStyle = item.color;
    ctx.strokeStyle = item.color;
    if (item.kind === "text") {
      ctx.font = `${item.fontSize}px Arial, sans-serif`;
      ctx.textBaseline = "top";
      item.text
        .split("\n")
        .forEach((line, i) =>
          ctx.fillText(line, item.x, item.y + i * item.fontSize * TEXT_LINE_HEIGHT),
        );
    } else if (item.points.length) {
      ctx.lineWidth = item.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (item.points.length === 1) {
        ctx.beginPath();
        ctx.arc(item.points[0].x, item.points[0].y, item.width / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(item.points[0].x, item.points[0].y);
        for (const point of item.points.slice(1)) ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
};

export const exportScreenshot = async (
  original: HTMLCanvasElement,
  annotations: AnnotationDocument,
): Promise<Blob> => {
  const canvas = document.createElement("canvas");
  canvas.width = original.width;
  canvas.height = original.height;
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas rendering is not available.");
    ctx.drawImage(original, 0, 0);
    ctx.scale(canvas.width / annotations.width, canvas.height / annotations.height);
    renderAnnotations(ctx, annotations.items);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("PNG export failed. The page may contain inaccessible images.")),
        "image/png",
      );
    });
  } finally {
    canvas.width = canvas.height = 0;
  }
};
