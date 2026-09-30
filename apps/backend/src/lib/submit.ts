/** Send a report and return its ID. Route navigation stays with the caller. */
export async function submitReport(body: FormData, signal: AbortSignal): Promise<string> {
  const response = await fetch("/api/v1/submit", { method: "POST", body, signal });
  if (response.status === 413)
    throw new Error("Submission is too large. On Vercel, keep the entire upload below 4 MB.");
  const payload: unknown = await response.json().catch(() => null);
  const result = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;

  if (!response.ok) {
    const message =
      result && "message" in result && typeof result.message === "string"
        ? result.message
        : `Submission could not be saved (${response.status}). Please try again.`;
    throw new Error(message);
  }
  if (!result || !("id" in result) || typeof result.id !== "string" || !result.id) {
    throw new Error(
      "The server returned an unexpected response. Check your inbox before submitting again.",
    );
  }
  return result.id;
}
