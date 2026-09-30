import { SondaCapture } from "./sonda-capture.js";
import type { MountOptions } from "./types.js";
export { SondaCapture };
export type * from "./types.js";
export type {
  Annotation,
  AnnotationDocument,
  StrokeAnnotation,
  TextAnnotation,
  Point,
} from "./annotations.js";
export const registerSondaCapture = (): void => {
  if (typeof customElements === "undefined")
    throw new Error("Sonda can only be registered in a browser.");
  const existing = customElements.get("sonda-capture");
  if (existing && existing !== SondaCapture)
    throw new Error("A different component already registered <sonda-capture>.");
  if (!existing) customElements.define("sonda-capture", SondaCapture);
};
export const mountSondaCapture = (
  options: MountOptions = {},
): {
  element: SondaCapture;
  destroy: () => void;
} => {
  registerSondaCapture();
  const container = options.container ?? document.body;
  if (!container) throw new Error("Mount Sonda after document.body is available.");
  const element = document.createElement("sonda-capture");
  element.position = options.position ?? "bottom-right";
  element.modules = [...(options.modules ?? ["screenshot", "replay"])];
  element.replay = { ...options.replay };
  if (options.botColor !== undefined) element.botColor = options.botColor;
  if (options.botEyeColor !== undefined) element.botEyeColor = options.botEyeColor;
  container.append(element);
  return { element, destroy: () => element.destroy() };
};
declare global {
  interface HTMLElementTagNameMap {
    "sonda-capture": SondaCapture;
  }
}
