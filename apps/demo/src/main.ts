import { html, render, nothing } from "lit";
import { mountSondaCapture } from "@sonda/client";
import type { AcceptDetail, MountOptions } from "@sonda/client";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "./style.css";
import { initializeBackendIntegration } from "./backend-integration";
import { requireElement } from "./dom";
import { replayIcon } from "./icons";
import { pageTemplate } from "./page";

render(pageTemplate, requireElement("#app"));
const disposeBackend = initializeBackendIntegration();

let mounted = mountSondaCapture();
const accepted: AcceptDetail[] = [];
let urls: string[] = [];
let replayPreview: HTMLDivElement | undefined;
let previewGeneration = 0;

function closeReplay(): void {
  ++previewGeneration;
  replayPreview?.remove();
  replayPreview = undefined;
}
function resetUrls(): void {
  for (const url of urls) URL.revokeObjectURL(url);
  urls = [];
}
function status(text: string): void {
  requireElement("#demo-status").textContent = text;
}

async function showReplay(result: Extract<AcceptDetail, { kind: "replay" }>): Promise<void> {
  closeReplay();
  const token = previewGeneration;
  const host = document.createElement("div");
  host.className = "accepted-replay";
  requireElement("#results").append(host);
  replayPreview = host;
  const label = document.createElement("p");
  label.textContent = "Preparing local replay details…";
  host.append(label);
  try {
    const artifact: unknown = JSON.parse(await result.blob.text());
    if (
      typeof artifact !== "object" ||
      artifact === null ||
      !("schemaVersion" in artifact) ||
      artifact.schemaVersion !== 1 ||
      !("rrwebVersion" in artifact) ||
      typeof artifact.rrwebVersion !== "string" ||
      !("metadata" in artifact) ||
      !("events" in artifact) ||
      !Array.isArray(artifact.events) ||
      !artifact.events.every(
        (event: unknown) =>
          typeof event === "object" &&
          event !== null &&
          "type" in event &&
          typeof event.type === "number",
      )
    )
      throw new Error("Invalid replay artifact");
    if (token !== previewGeneration || !host.isConnected) return;
    label.textContent =
      "Accepted replay data · full playback is available in the widget before Accept";
    const details = document.createElement("pre");
    details.textContent = JSON.stringify(
      {
        schemaVersion: artifact.schemaVersion,
        rrwebVersion: artifact.rrwebVersion,
        metadata: artifact.metadata,
        eventTypes: (artifact.events as { type: number }[]).reduce<Record<string, number>>(
          (counts, event) => {
            const type = String(event.type);
            counts[type] = (counts[type] ?? 0) + 1;
            return counts;
          },
          {},
        ),
      },
      null,
      2,
    );
    const close = document.createElement("button");
    close.textContent = "Close details";
    close.onclick = closeReplay;
    host.append(details, close);
  } catch (error) {
    if (token === previewGeneration)
      label.textContent = `Details unavailable: ${error instanceof Error ? error.message : String(error)}. The JSON is still available to download.`;
  }
}

function bind(): void {
  mounted.element.addEventListener("sonda-accept", (event) => {
    const result = event.detail;
    accepted.push(result);
    closeReplay();
    urls.push(URL.createObjectURL(result.blob));
    render(
      accepted.map((result, index) => {
        const fileUrl = urls[index]!;
        return html`<article class="result-card">
          ${result.kind === "screenshot" ? html`<img src=${fileUrl} alt="Accepted annotated screenshot" />` : html`<span class="replay-mark" aria-hidden="true">${replayIcon}</span>`}
          <div class="result-copy">
            <span class="eyebrow"
              >CAPTURE ${String(index + 1).padStart(2, "0")} / ACCEPTED LOCALLY</span
            >
            <h3>
              ${result.kind === "screenshot" ? "The issue, in focus." : "The steps that led here."}
            </h3>
            <p>
              ${result.kind === "screenshot" ? `${result.capture.pixelWidth} × ${result.capture.pixelHeight} · ${result.annotations.items.length} annotations` : `${Math.round(result.replay.durationMs / 1000)} seconds · ${result.replay.eventCount} events`}
              · ${Math.max(1, Math.round(result.blob.size / 1024))} KB
            </p>
          </div>
          <div class="result-actions">
            ${result.kind === "replay" ? html`<button @click=${() => void showReplay(result)}>View replay data</button>` : nothing}<a
              href=${fileUrl}
              download=${result.kind === "screenshot" ? "sonda-screenshot.png" : "sonda-replay.json"}
              >Download ${result.kind === "screenshot" ? "PNG" : "JSON"}
              <span aria-hidden="true">↓</span></a
            >
          </div>
        </article>`;
      }),
      requireElement("#results"),
    );
    requireElement("#capture-count").textContent =
      `${accepted.length} CAPTURE${accepted.length === 1 ? "" : "S"} THIS SESSION`;
    status("Capture accepted. Nothing was uploaded. Download it or explicitly submit it below.");
  });
  mounted.element.addEventListener("sonda-discard", () =>
    status("Capture discarded. Nothing was saved."),
  );
  mounted.element.addEventListener("sonda-error", (event) => status(event.detail.message));
}
bind();

requireElement<HTMLButtonElement>("#capture-screenshot").addEventListener(
  "click",
  () => void mounted.element.captureScreenshot(),
);

declare global {
  interface Window {
    sondaDemo: {
      readonly element: typeof mounted.element;
      readonly results: AcceptDetail[];
      remount(options?: MountOptions): void;
    };
  }
}
window.sondaDemo = {
  get element() {
    return mounted.element;
  },
  get results() {
    return accepted;
  },
  remount(options = {}) {
    const appearance = {
      botColor: mounted.element.botColor,
      botEyeColor: mounted.element.botEyeColor,
    };
    mounted.destroy();
    mounted = mountSondaCapture({ ...appearance, ...options });
    bind();
  },
};
function dispose(): void {
  closeReplay();
  resetUrls();
  mounted.destroy();
  disposeBackend();
}
function onPageHide(event: PageTransitionEvent): void {
  // Preserve the live demo when the browser caches the page for back navigation.
  if (!event.persisted) dispose();
}
window.addEventListener("pagehide", onPageHide);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    window.removeEventListener("pagehide", onPageHide);
    dispose();
  });
