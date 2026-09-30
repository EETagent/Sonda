import { expect, it } from "vitest";
import { AnnotationHistory, annotationBounds, type StrokeAnnotation } from "../../src/annotations";

it("measures a long stroke without exceeding the function argument limit", () => {
  const stroke: StrokeAnnotation = {
    id: "long-stroke",
    kind: "stroke",
    color: "#000",
    width: 4,
    points: Array.from({ length: 200_000 }, (_, x) => ({ x, y: x % 10 })),
  };
  expect(annotationBounds(stroke)).toEqual({ x: -2, y: -2, width: 200_003, height: 13 });
});

it("replaces the redo branch after committing a new annotation", () => {
  const history = new AnnotationHistory();
  const stroke: StrokeAnnotation = {
    id: "first",
    kind: "stroke",
    color: "#000",
    width: 4,
    points: [{ x: 1, y: 1 }],
  };
  history.commit([stroke]);
  history.commit([stroke, { ...stroke, id: "second" }]);
  history.undo();
  history.commit([{ ...stroke, id: "replacement" }]);
  expect(history.canRedo).toBe(false);
  history.undo();
  expect(history.items).toEqual([stroke]);
});
