/** Resolve required markup once and fail with an actionable error if it is missing. */
export function requireElement<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Demo element ${selector} is missing.`);
  return element;
}
