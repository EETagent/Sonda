import { html } from "lit";

export const probeIcon = html`<img
  class="brand-icon"
  src="${import.meta.env.BASE_URL}sonda-probe.png"
  alt=""
  width="36"
  height="36"
/>`;

export const captureIcon = html`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" stroke="currentColor" stroke-width="1.5" />
  <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5" />
</svg>`;
export const replayIcon = html`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <rect x="3" y="5" width="18" height="14" rx="1" stroke="currentColor" stroke-width="1.5" />
  <path d="m10 9 5 3-5 3V9Z" fill="currentColor" />
</svg>`;
