/** Keep text bounds, canvas rendering, and the text editor on the same line spacing. */
export const TEXT_LINE_HEIGHT = 1.25;
const HISTORY_LIMIT = 60;

export interface Point {
  x: number;
  y: number;
}
export interface StrokeAnnotation {
  id: string;
  kind: "stroke";
  points: Array<Point>;
  color: string;
  width: number;
}
export interface TextAnnotation {
  id: string;
  kind: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}
export type Annotation = StrokeAnnotation | TextAnnotation;
export interface AnnotationDocument {
  schemaVersion: 1;
  width: number;
  height: number;
  items: Array<Annotation>;
}
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** History stores only completed operations, never per-pointer-frame snapshots. */
export class AnnotationHistory {
  private states: Array<Array<Annotation>>;
  private cursor = 0;
  constructor(initial: Array<Annotation> = []) {
    this.states = [structuredClone(initial)];
  }
  get items(): Array<Annotation> {
    return this.states[this.cursor];
  }
  get canUndo(): boolean {
    return this.cursor > 0;
  }
  get canRedo(): boolean {
    return this.cursor < this.states.length - 1;
  }
  commit(items: Array<Annotation>): void {
    if (JSON.stringify(items) === JSON.stringify(this.items)) return;
    this.states = this.states.slice(0, this.cursor + 1);
    this.states.push(structuredClone(items));
    if (this.states.length > HISTORY_LIMIT) this.states.shift();
    this.cursor = this.states.length - 1;
  }
  undo(): void {
    if (this.canUndo) this.cursor--;
  }
  redo(): void {
    if (this.canRedo) this.cursor++;
  }
  reset(): void {
    this.states = [[]];
    this.cursor = 0;
  }
}

export const toImagePoint = (
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  width: number,
  height: number,
): Point => {
  return {
    x: Math.max(0, Math.min(width, ((clientX - rect.left) / Math.max(1, rect.width)) * width)),
    y: Math.max(0, Math.min(height, ((clientY - rect.top) / Math.max(1, rect.height)) * height)),
  };
};
export const translateAnnotation = (item: Annotation, dx: number, dy: number): Annotation => {
  return item.kind === "text"
    ? { ...item, x: item.x + dx, y: item.y + dy }
    : { ...item, points: item.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
};
export const annotationBounds = (
  item: Annotation,
  measure?: (text: string, fontSize: number) => number,
): Bounds => {
  if (item.kind === "text") {
    const lines = item.text.split("\n");
    return {
      x: item.x,
      y: item.y,
      width: Math.max(
        1,
        ...lines.map((line) =>
          measure ? measure(line, item.fontSize) : line.length * item.fontSize * 0.62,
        ),
      ),
      height: lines.length * item.fontSize * TEXT_LINE_HEIGHT,
    };
  }
  if (!item.points.length) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of item.points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return {
    x: minX - item.width / 2,
    y: minY - item.width / 2,
    width: maxX - minX + item.width,
    height: maxY - minY + item.width,
  };
};
const distanceToSegment = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t =
    dx === 0 && dy === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
export const hitTest = (
  items: Array<Annotation>,
  point: Point,
  tolerance = 6,
): Annotation | undefined => {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.kind === "text") {
      const bounds = annotationBounds(item);
      if (
        point.x >= bounds.x - tolerance &&
        point.x <= bounds.x + bounds.width + tolerance &&
        point.y >= bounds.y - tolerance &&
        point.y <= bounds.y + bounds.height + tolerance
      )
        return item;
    } else {
      for (let j = 0; j < item.points.length; j++) {
        if (
          distanceToSegment(point, item.points[j], item.points[Math.max(0, j - 1)]) <=
          tolerance + item.width / 2
        )
          return item;
      }
    }
  }
  return undefined;
};
