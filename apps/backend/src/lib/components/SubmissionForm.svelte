<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { goto } from "$app/navigation";
  import { formatBytes } from "$lib/submissions";
  import { submitReport } from "$lib/submit";
  import { MAX_SCREENSHOT_BYTES, MAX_REPLAY_BYTES } from "$lib/upload-limits";

  let { oncancel }: { oncancel?: () => void } = $props();

  let form: HTMLFormElement;
  let screenshotInput: HTMLInputElement;
  let replayInput: HTMLInputElement;
  let errorElement = $state<HTMLDivElement>();
  let screenshot = $state<File | null>(null);
  let replay = $state<File | null>(null);
  let submitting = $state(false);
  let error = $state("");
  let savedUrl = $state("");
  let controller: AbortController | undefined;
  let destroyed = false;

  onDestroy(() => {
    destroyed = true;
    controller?.abort();
  });

  const selectFile = (event: Event, kind: "screenshot" | "replay") => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    error = "";
    savedUrl = "";
    if (kind === "screenshot") screenshot = file;
    else replay = file;
  };

  const removeFile = (kind: "screenshot" | "replay") => {
    if (kind === "screenshot") {
      screenshot = null;
      screenshotInput.value = "";
      screenshotInput.focus();
    } else {
      replay = null;
      replayInput.value = "";
      replayInput.focus();
    }
    error = "";
  };

  const showError = async (message: string) => {
    error = message;
    await tick();
    if (!destroyed) errorElement?.focus();
  };

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (submitting) return;
    error = "";
    savedUrl = "";

    if (!screenshot && !replay) {
      await showError("Add a PNG screenshot, an rrweb JSON recording, or both.");
      return;
    }
    if (screenshot && (screenshot.size === 0 || screenshot.size > MAX_SCREENSHOT_BYTES)) {
      await showError("Choose a non-empty PNG screenshot up to 10 MB.");
      return;
    }
    if (replay && (replay.size === 0 || replay.size > MAX_REPLAY_BYTES)) {
      await showError("Choose a non-empty JSON recording up to 12 MB.");
      return;
    }

    // Collect fields before disabling the fieldset: disabled fields are omitted from FormData.
    const body = new FormData(form);
    if (!screenshot) body.delete("screenshot");
    if (!replay) body.delete("replay");
    submitting = true;
    controller = new AbortController();

    try {
      const id = await submitReport(body, controller.signal);
      if (destroyed) return;
      savedUrl = `/submissions/${encodeURIComponent(id)}`;
      form.reset();
      screenshot = null;
      replay = null;
      await goto(savedUrl, { invalidateAll: true });
    } catch (cause) {
      if (destroyed || controller.signal.aborted) return;
      await showError(
        savedUrl
          ? "Your submission was saved, but the detail page could not be opened. Use the link below to view it."
          : cause instanceof Error
            ? cause.message
            : "Could not reach the server. Please try again.",
      );
    } finally {
      if (!destroyed) {
        submitting = false;
      }
    }
  };
</script>

<section class="submission-form-panel" id="new-submission" aria-labelledby="new-submission-heading">
  <div class="panel-heading">
    <div>
      <span class="eyebrow">CAPTURE / 01</span>
      <h2 id="new-submission-heading">Create a capture</h2>
      <p>
        Attach a screenshot or replay and describe the issue. You can prepare an agent handoff after
        saving.
      </p>
    </div>
    {#if oncancel}
      <button
        class="icon-button"
        type="button"
        aria-label="Close new capture form"
        onclick={oncancel}
        disabled={submitting}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg
        >
      </button>
    {/if}
  </div>

  <form
    bind:this={form}
    onsubmit={submit}
    action="/api/v1/submit"
    method="POST"
    enctype="multipart/form-data"
    aria-busy={submitting}
  >
    <fieldset disabled={submitting}>
      <legend class="sr-only">Submission files and optional details</legend>
      <div class="upload-grid">
        <div class="upload-field">
          <label class="file-picker" class:has-file={screenshot !== null}>
            <input
              bind:this={screenshotInput}
              type="file"
              name="screenshot"
              accept="image/png,.png"
              onchange={(event) => selectFile(event, "screenshot")}
              aria-describedby="screenshot-hint"
            />
            <span class="upload-icon" aria-hidden="true"
              ><svg
                width="23"
                height="23"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><rect x="3" y="3" width="18" height="18" rx="3" /><circle
                  cx="8"
                  cy="8"
                  r="1.5"
                /><path d="m21 15-5-5-7 8-3-3-3 3" /></svg
              ></span
            >
            <span class="file-picker-title">Screenshot</span>
            <span class="file-picker-name"
              >{screenshot ? screenshot.name : "Choose a PNG file"}</span
            >
            <span class="file-picker-hint" id="screenshot-hint"
              >{screenshot ? formatBytes(screenshot.size) : "PNG · up to 10 MB"}</span
            >
          </label>
          {#if screenshot}<button
              class="text-button remove-file"
              type="button"
              onclick={() => removeFile("screenshot")}>Remove screenshot</button
            >{/if}
        </div>
        <div class="upload-field">
          <label class="file-picker" class:has-file={replay !== null}>
            <input
              bind:this={replayInput}
              type="file"
              name="replay"
              accept="application/json,.json"
              onchange={(event) => selectFile(event, "replay")}
              aria-describedby="replay-hint"
            />
            <span class="upload-icon" aria-hidden="true"
              ><svg
                width="23"
                height="23"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><rect x="3" y="3" width="18" height="18" rx="3" /><path
                  d="m10 8 6 4-6 4V8Z"
                /></svg
              ></span
            >
            <span class="file-picker-title">Session replay</span>
            <span class="file-picker-name"
              >{replay ? replay.name : "Choose an rrweb recording"}</span
            >
            <span class="file-picker-hint" id="replay-hint"
              >{replay ? formatBytes(replay.size) : "JSON · up to 12 MB"}</span
            >
          </label>
          {#if replay}<button
              class="text-button remove-file"
              type="button"
              onclick={() => removeFile("replay")}>Remove replay</button
            >{/if}
        </div>
      </div>

      <div class="form-field-grid">
        <label class="form-field" for="submission-title"
          ><span>Title <span class="optional">optional</span></span><input
            id="submission-title"
            name="title"
            type="text"
            maxlength="160"
            placeholder="What caught your attention?"
          /></label
        >
        <label class="form-field" for="submission-url"
          ><span>Source URL <span class="optional">optional</span></span><input
            id="submission-url"
            name="url"
            type="url"
            maxlength="2048"
            placeholder="https://your-app.com"
            spellcheck="false"
          /></label
        >
        <label class="form-field full-width" for="submission-description"
          ><span>Description <span class="optional">optional</span></span><textarea
            id="submission-description"
            name="description"
            rows="3"
            maxlength="10000"
            placeholder="What happened? What did you expect instead?"></textarea></label
        >
      </div>
    </fieldset>

    {#if error}
      <div class="inline-message error-message" role="alert" tabindex="-1" bind:this={errorElement}>
        <p>{error}</p>
        {#if savedUrl}<a class="inline-link" href={savedUrl}
            >Open saved capture <span aria-hidden="true">↗</span></a
          >{/if}
      </div>
    {/if}

    <div class="form-actions">
      <p>Local development only. This inbox has no authentication.</p>
      <div class="button-group">
        {#if oncancel}<button
            class="button button-secondary"
            type="button"
            onclick={oncancel}
            disabled={submitting}>Cancel</button
          >{/if}
        <button
          class="button button-primary"
          type="submit"
          disabled={submitting || Boolean(savedUrl)}
        >
          {#if submitting}<span class="spinner" aria-hidden="true"></span>{:else}<svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              ><path d="M12 16V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg
            >{/if}
          {submitting ? "Saving capture…" : "Create capture"}
        </button>
      </div>
    </div>
    <span class="sr-only" role="status"
      >{submitting ? "Uploading and saving your submission." : ""}</span
    >
  </form>
</section>
