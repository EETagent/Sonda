<script lang="ts">
  import { handoffDestinations, type HandoffDestination } from "$lib/handoff";
  import type { Submission } from "$lib/submissions";
  import DestinationIcon from "./DestinationIcon.svelte";

  let { report }: { report: Submission } = $props();
  let destination = $state<HandoffDestination>("cursor");
  let prompt = $state("");
  let feedback = $state("");
  let nextId = 0;
  let handoffs = $state<
    Array<{ id: number; destination: HandoffDestination; label: string; prompt: string }>
  >([]);
  const selected = $derived(handoffDestinations.find((item) => item.id === destination)!);
  const attachments = $derived(
    [report.screenshot ? "Screenshot" : "", report.replay ? "Session replay" : ""].filter(Boolean),
  );

  function useSuggestion() {
    const instructions: Record<HandoffDestination, string> = {
      cursor:
        "Investigate the root cause, use the attached evidence to reproduce the issue, and propose a fix with a regression test.",
      slack:
        "Summarize the issue for the team, explain the customer impact, and ask who can take a look. Include the attached evidence.",
      linear:
        "Draft an issue with a clear title, steps to reproduce, expected and actual behavior, and acceptance criteria.",
      github:
        "Draft a bug report with reproduction steps, expected and actual behavior, and the attached evidence. Suggest where to start investigating.",
    };
    prompt = `${instructions[destination]}\n\nReport: ${report.title}${report.description ? `\n${report.description}` : ""}`;
    feedback = "";
  }

  function prepareHandoff() {
    const instructions = prompt.trim();
    if (!instructions) return;
    handoffs = [
      { id: ++nextId, destination, label: selected.label, prompt: instructions },
      ...handoffs,
    ].slice(0, 3);
    feedback = `Brief prepared for ${selected.label}. Nothing was sent.`;
    prompt = "";
  }

  async function copyBrief(handoff: (typeof handoffs)[number]) {
    const brief = [
      report.title,
      report.description,
      `Report: ${window.location.origin}/submissions/${encodeURIComponent(report.id)}`,
      `Evidence: ${attachments.join(" + ")}`,
      `Destination: ${handoff.label}`,
      "",
      handoff.prompt,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(brief);
      feedback = "Handoff brief copied. Ready to paste into your workflow.";
    } catch {
      feedback = "Clipboard unavailable. You can select and copy the brief below.";
    }
  }
</script>

<section class="agent-handoff" aria-labelledby="handoff-heading">
  <div class="handoff-heading">
    <div class="handoff-eyebrow">AGENT / INSTRUCTIONS</div>
    <h2 id="handoff-heading">Assign the next step.</h2>
    <p>Write the task. The evidence is attached.</p>
  </div>

  <div class="agent-context" aria-label="Included context">
    <span class="agent-context-label">CONTEXT READY</span>
    <strong>{report.title}</strong>
    <div>
      {#each attachments as attachment}
        <span class="agent-context-item"><span aria-hidden="true">✓</span> {attachment}</span>
      {/each}
    </div>
  </div>

  <div class="destination-label">Send to</div>

  <div class="destination-options" role="group" aria-label="Handoff destination">
    {#each handoffDestinations as item (item.id)}
      <button
        type="button"
        class="destination-option"
        class:selected={destination === item.id}
        aria-pressed={destination === item.id}
        onclick={() => {
          destination = item.id;
          feedback = "";
        }}
      >
        <DestinationIcon name={item.id} /><span>{item.label}</span>
      </button>
    {/each}
  </div>

  <form
    class="handoff-composer"
    onsubmit={(event) => {
      event.preventDefault();
      prepareHandoff();
    }}
  >
    <label class="composer-label" for="handoff-prompt">Instructions</label>
    <textarea
      id="handoff-prompt"
      bind:value={prompt}
      placeholder={selected.hint}
      rows="3"
      maxlength="4000"
      onkeydown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.isComposing) {
          event.preventDefault();
          prepareHandoff();
        }
      }}></textarea>
    <div class="composer-toolbar">
      <div class="attached-context" title="This report and its existing evidence are included">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
          ><path d="m8 12 7-7a3 3 0 0 1 4 4L9 19a5 5 0 0 1-7-7L12 2m-7 13 10-10" /></svg
        >
        <span>Report attached</span><span class="context-count">{attachments.length}</span>
      </div>
      <button
        class="handoff-send"
        type="submit"
        disabled={!prompt.trim()}
        aria-keyshortcuts="Control+Enter Meta+Enter"
      >
        <span>Prepare for {selected.label}</span><svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg
        >
      </button>
    </div>
  </form>
  <div class="handoff-suggestions">
    <button type="button" onclick={useSuggestion}
      ><span aria-hidden="true">↗</span> {selected.action}</button
    >
    <span>Preview only · nothing is sent</span>
  </div>
  <p class="handoff-status" role="status" aria-live="polite">{feedback}</p>

  {#if handoffs.length}
    <div class="handoff-history" aria-label="Mock handoffs">
      {#each handoffs as handoff (handoff.id)}
        <article class="handoff-result">
          <div class="handoff-result-heading">
            <span class="handoff-result-icon"><DestinationIcon name={handoff.destination} /></span>
            <div><strong>{handoff.label}</strong><span>Mock handoff · ready for review</span></div>
            <button type="button" class="copy-brief" onclick={() => void copyBrief(handoff)}
              ><svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                aria-hidden="true"
                ><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4H4v12h4" /></svg
              > Copy brief</button
            >
          </div>
          <details>
            <summary>Review handoff</summary>
            <div class="handoff-brief">
              <strong>{report.title}</strong>
              <p>{handoff.prompt}</p>
              <span>{attachments.join(" + ")} included · report #{report.id.slice(0, 8)}</span>
            </div>
          </details>
        </article>
      {/each}
    </div>
  {/if}
</section>

<style>
  .agent-handoff {
    position: relative;
    isolation: isolate;
    margin: 5px 0 0;
    padding: 22px;
    border: 1px solid var(--line-soft);
    border-radius: 6px;
    background: var(--wash);
    box-shadow: none;
  }
  .handoff-heading {
    margin-bottom: 18px;
  }
  .handoff-eyebrow {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--muted);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.09em;
  }
  h2 {
    margin: 10px 0 7px;
    color: var(--ink);
    font-size: 22px;
    line-height: 1.18;
    font-weight: 650;
    letter-spacing: -0.04em;
  }
  .handoff-heading p {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.6;
  }
  .agent-context {
    display: grid;
    gap: 8px;
    padding: 13px 0;
    margin-bottom: 20px;
    border-top: 1px solid var(--line-soft);
    border-bottom: 1px solid var(--line-soft);
    background: transparent;
  }
  .agent-context-label,
  .destination-label {
    color: var(--muted);
    font-size: 10px;
    font-weight: 650;
    letter-spacing: 0.08em;
  }
  .agent-context strong {
    overflow: hidden;
    color: var(--ink);
    font-size: 12px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .agent-context > div {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .agent-context-item {
    padding: 3px 7px;
    border-radius: 6px;
    background: var(--wash);
    color: var(--muted);
    font-size: 10px;
  }
  .agent-context-item span {
    color: var(--muted);
  }
  .destination-label {
    margin-bottom: 9px;
  }
  .destination-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
    margin-bottom: 17px;
  }
  .destination-option {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    min-height: 38px;
    padding: 8px 10px;
    border: 1px solid var(--line-soft);
    border-radius: 9px;
    background: var(--surface);
    color: var(--ink);
    font-size: 12px;
    transition:
      background-color 150ms ease,
      border-color 150ms ease;
  }
  .destination-option.selected {
    color: var(--ink);
    border-color: var(--ink);
    background: var(--highlight);
    box-shadow: none;
  }
  .handoff-composer {
    padding: 13px;
    border: 1px solid var(--line-soft);
    border-radius: 6px;
    background: var(--surface);
    box-shadow: none;
  }
  .composer-label {
    display: block;
    margin-bottom: 8px;
    color: var(--ink);
    font-size: 11px;
    font-weight: 600;
  }
  textarea {
    display: block;
    width: 100%;
    min-height: 125px;
    max-height: 300px;
    padding: 0;
    resize: vertical;
    border: 0;
    background: transparent;
    color: var(--ink);
    font-size: 13px;
    line-height: 1.65;
  }
  textarea::placeholder {
    color: var(--muted);
  }
  textarea:focus-visible {
    outline: none;
  }
  .handoff-composer:focus-within {
    border-color: var(--muted);
    box-shadow:
      0 0 0 3px #16161615,
      0 8px 28px #1616160b;
  }
  .composer-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 10px;
  }
  .attached-context {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--muted);
    font-size: 11px;
  }
  .context-count {
    display: grid;
    place-items: center;
    width: 19px;
    height: 19px;
    border: 1px solid var(--line-soft);
    border-radius: 6px;
    color: var(--muted);
  }
  .handoff-send {
    display: inline-flex;
    align-items: center;
    gap: 13px;
    min-height: 40px;
    padding: 9px 12px 9px 15px;
    border: 1px solid var(--ink);
    border-radius: 9px;
    background: var(--highlight);
    color: var(--ink);
    font-size: 12px;
    font-weight: 550;
    transition: background-color 150ms ease;
  }
  .handoff-send:disabled {
    background: var(--wash);
    color: var(--muted);
    opacity: 1;
  }
  .handoff-suggestions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 12px;
  }
  .handoff-suggestions button {
    display: inline-flex;
    gap: 7px;
    align-items: center;
    padding: 7px 11px;
    min-height: 34px;
    border: 1px solid var(--line-soft);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
    font-size: 11px;
  }
  .handoff-suggestions > span {
    color: var(--muted);
    font-size: 10px;
  }
  .handoff-status {
    margin: 12px 0 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
  .handoff-status:empty {
    margin: 0;
  }
  .handoff-history {
    display: grid;
    gap: 10px;
    margin-top: 20px;
  }
  .handoff-result {
    min-width: 0;
    padding: 15px;
    border: 1px solid var(--line-soft);
    border-radius: 6px;
    background: var(--surface);
  }
  .handoff-result-heading {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }
  .handoff-result-icon {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--line-soft);
    border-radius: 10px;
    background: var(--surface);
  }
  .handoff-result-heading strong {
    display: block;
    color: var(--ink);
    font-size: 12px;
    font-weight: 600;
  }
  .handoff-result-heading div > span {
    display: block;
    color: var(--muted);
    font-size: 10px;
    margin-top: 3px;
  }
  .copy-brief {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 34px;
    margin-left: auto;
    padding: 6px 8px;
    border: 1px solid var(--line-soft);
    border-radius: 8px;
    background: var(--surface);
    color: var(--muted);
    font-size: 11px;
  }
  details {
    margin-top: 12px;
  }
  summary {
    width: fit-content;
    cursor: pointer;
    color: var(--muted);
    font-size: 11px;
  }
  .handoff-brief {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--wash);
    color: var(--ink);
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  .handoff-brief strong {
    font-weight: 600;
  }
  .handoff-brief p {
    margin: 10px 0;
    white-space: pre-wrap;
    line-height: 1.7;
  }
  .handoff-brief > span {
    color: var(--muted);
    font-size: 10px;
  }
  @media (hover: hover) and (pointer: fine) {
    .destination-option:hover {
      border-color: var(--ink);
      background: var(--highlight);
    }
    .handoff-send:hover:not(:disabled) {
      background: var(--highlight-hover);
    }
    .handoff-suggestions button:hover,
    .copy-brief:hover {
      background: var(--line-soft);
    }
  }
  @media (max-width: 700px) {
    .agent-handoff {
      padding: 18px;
      margin-top: 0;
      border-radius: 6px;
    }
    .handoff-composer {
      padding: 15px;
      border-radius: 6px;
    }
    textarea {
      font-size: 16px;
    }
    .destination-option {
      padding: 9px 11px;
      font-size: 11px;
    }
    .handoff-suggestions {
      align-items: flex-start;
      flex-direction: column;
    }
    .composer-toolbar {
      align-items: flex-start;
    }
  }
  @media (max-width: 380px) {
    .handoff-send {
      width: 100%;
      justify-content: space-between;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .destination-option,
    .handoff-send {
      transition: none;
    }
  }
</style>
