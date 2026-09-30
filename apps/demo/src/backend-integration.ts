import type { AcceptDetail } from "@sonda/client";
import "./backend-integration.css";

// Uploading is an explicit host-app action, not a side effect of accepting in the widget.
export function initializeBackendIntegration(): () => void {
  const backend = new URL(import.meta.env.VITE_SONDA_BACKEND_URL || "http://127.0.0.1:3001");
  let panel: HTMLElement | undefined;
  let controller: AbortController | undefined;

  const offerUpload = (event: Event): void => {
    const result = (event as CustomEvent<AcceptDetail>).detail;
    controller?.abort();
    panel?.remove();
    const section = document.createElement("section");
    panel = section;
    section.className = "backend-submission";
    section.setAttribute("data-replay-private", "");
    section.setAttribute("aria-label", "Submit latest accepted capture");
    const copy = document.createElement("p");
    copy.textContent =
      "Ready to share context? Submit your latest accepted capture to the Sonda inbox.";
    const actions = document.createElement("div");
    actions.className = "backend-submission-actions";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Submit to backend";
    const link = document.createElement("a");
    link.textContent = "View submission";
    link.target = "_blank";
    link.rel = "noreferrer";
    link.hidden = true;
    const message = document.createElement("p");
    message.setAttribute("role", "status");
    message.textContent =
      "Nothing is uploaded until you submit. The backend inbox has no authentication.";
    actions.append(button, link);
    section.append(copy, actions, message);
    (document.querySelector("#results") ?? document.querySelector("main"))?.after(section);

    button.addEventListener("click", async () => {
      if (button.disabled) return;
      const body = new FormData();
      body.set(
        result.kind,
        result.blob,
        result.kind === "screenshot" ? "screenshot.png" : "replay.json",
      );
      body.set("title", result.kind === "screenshot" ? "Demo screenshot" : "Demo session replay");
      body.set("url", window.location.href);
      body.set(
        "metadata",
        JSON.stringify(
          result.kind === "screenshot"
            ? { capture: result.capture, annotations: result.annotations }
            : { replay: result.replay },
        ),
      );
      const upload = new AbortController();
      controller = upload;
      button.disabled = true;
      button.textContent = "Submitting…";
      message.textContent = "Uploading the accepted capture…";
      try {
        const response = await fetch(new URL("/api/v1/submit", backend), {
          method: "POST",
          body,
          headers: { accept: "application/json" },
          signal: upload.signal,
        });
        if (response.status === 413)
          throw new Error("Capture is too large. On Vercel, keep the entire upload below 4 MB.");
        const payload: unknown = await response.json();
        if (typeof payload !== "object" || payload === null)
          throw new Error("The backend returned an invalid response.");
        if (!response.ok)
          throw new Error(
            ("message" in payload && typeof payload.message === "string"
              ? payload.message
              : undefined) || `Upload failed (${response.status}).`,
          );
        if (!("id" in payload) || typeof payload.id !== "string" || !payload.id)
          throw new Error("The backend returned an invalid submission.");
        if (upload.signal.aborted) return;
        link.href = new URL(`/submissions/${encodeURIComponent(payload.id)}`, backend).href;
        link.hidden = false;
        button.hidden = true;
        message.textContent = "Submission saved. Open it to view your capture and playback.";
        link.focus();
      } catch (cause) {
        if (upload.signal.aborted) return;
        message.textContent = `${cause instanceof Error ? cause.message : "Upload failed."} Check that the backend is available, then retry. Your local download is still available.`;
      } finally {
        if (!upload.signal.aborted) {
          button.disabled = false;
          button.textContent = "Submit to backend";
        }
      }
    });
  };

  document.addEventListener("sonda-accept", offerUpload);
  const dispose = (): void => {
    document.removeEventListener("sonda-accept", offerUpload);
    controller?.abort();
    panel?.remove();
  };
  return dispose;
}
