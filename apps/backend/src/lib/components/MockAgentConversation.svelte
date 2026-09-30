<script lang="ts">
  import type { Submission } from "$lib/submissions";

  let { report }: { report: Submission } = $props();
  const taskId = $derived(`DEMO-${report.id.slice(0, 4).toUpperCase()}`);
  const isBillingOverviewDemo = $derived(
    report.title.toLowerCase().includes("workspace overview") &&
      report.description.toLowerCase().includes("billing") &&
      report.description.toLowerCase().includes("overview"),
  );
  const taskTitle = $derived(
    isBillingOverviewDemo
      ? "Trace the Billing → Overview transition"
      : `Investigate ${report.title}`,
  );
</script>

{#snippet agentAvatar()}
  <span class="agent-avatar" aria-hidden="true">
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
      <path
        d="M16 4c2.8 0 3.5 3.2 5.6 4.4 2.2 1.3 5.4.5 6.3 3.1.9 2.5-1.7 4.4-1.7 6.9 0 2.4 2 4.9.2 6.8-1.9 2-4.7.3-7.1.9-2.4.7-3.9 3.4-6.4 2.6-2.6-.8-2.7-4-4.5-5.7-1.8-1.7-5-1.6-5.5-4.3-.5-2.5 2.4-3.9 3.3-6.2C7.1 10.2 6 7.3 8.2 5.9 10.5 4.4 13.3 4 16 4Z"
        fill="currentColor"
      />
      <ellipse cx="12" cy="14" rx="1.5" ry="2.4" fill="var(--ink)" />
      <ellipse cx="20" cy="14" rx="1.5" ry="2.4" fill="var(--ink)" />
      <path
        d="M12.5 20c1.7 2 5.3 2 7 0"
        stroke="var(--ink)"
        stroke-width="1.8"
        stroke-linecap="round"
      />
    </svg>
  </span>
{/snippet}

<section class="agent-conversation" aria-labelledby="agent-conversation-heading">
  <header class="conversation-header">
    <div>
      <span class="conversation-eyebrow">AGENT CONVERSATION</span>
      <h2 id="agent-conversation-heading">Investigation log</h2>
    </div>
    <span class="demo-badge">Demo</span>
  </header>

  <div class="conversation-thread">
    <div class="agent-message">
      {@render agentAvatar()}
      <div class="message-content">
        <div class="message-meta"><strong>Sonda Agent</strong><span>Preview update</span></div>
        {#if isBillingOverviewDemo}
          <p>
            I reviewed the screenshot: the embedded app is on Overview. The report says the session
            came from Billing, so I’m inspecting that transition in the replay.
          </p>
        {:else}
          <p>
            I reviewed the {report.screenshot ? "screenshot" : "capture"} for
            <strong>{report.title}</strong>.
            {#if report.replay}
              The replay gives me the steps leading into this screen, so I’m checking where the
              reported flow diverges.
            {:else}
              The captured screen gives me the visible state; I’m mapping the expected behavior
              before reproducing it.
            {/if}
          </p>
        {/if}
        <div class="evidence-reference">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            aria-hidden="true"
            ><rect x="3" y="3" width="18" height="18" rx="3" /><path
              d="m3 17 5-5 4 4 4-6 5 5"
            /></svg
          >
          <span
            >{report.screenshot
              ? `Screenshot · ${report.screenshot.width} × ${report.screenshot.height}`
              : "Session replay"}</span
          >
          {#if report.screenshot && report.replay}<span class="evidence-extra">+ replay</span>{/if}
        </div>
      </div>
    </div>

    <div class="conversation-event">
      <span class="event-icon" aria-hidden="true">✓</span>
      <div>
        <strong>Issue identified</strong><span
          >{isBillingOverviewDemo
            ? "The Billing → Overview switch needs verification."
            : "The reported behavior is ready for investigation."}</span
        >
      </div>
    </div>

    <div class="task-card">
      <div class="task-card-top">
        <span>↗ TASK OPENED</span><span class="task-status"
          ><span aria-hidden="true"></span> In progress</span
        >
      </div>
      <strong class="task-title">{taskTitle}</strong>
      <span class="task-id">{taskId} · Mock task</span>
      <div class="task-steps" aria-label="Mock task progress">
        <span><span class="step-done" aria-hidden="true">✓</span> Evidence reviewed</span>
        <span><span class="step-done" aria-hidden="true">✓</span> Task opened</span>
        <span
          ><span class="step-current" aria-hidden="true"></span>
          {isBillingOverviewDemo
            ? "Checking the Billing → Overview switch"
            : report.replay
              ? "Tracing recorded steps"
              : "Reproducing from the screenshot"}</span
        >
      </div>
    </div>

    <div class="agent-message last-message">
      {@render agentAvatar()}
      <div class="message-content">
        <div class="message-meta"><strong>Sonda Agent</strong><span>Preview update</span></div>
        <p>
          {isBillingOverviewDemo
            ? `I opened ${taskId} and started replaying the Billing → Overview switch. Next I’ll check whether the route and visible state stay in sync.`
            : `I opened ${taskId} and started working through the evidence. Next I’ll compare the expected behavior with what the capture shows.`}
        </p>
      </div>
    </div>
  </div>
  <p class="conversation-disclaimer">
    Illustrative conversation. No agent ran and no task was created.
  </p>
</section>

<style>
  .agent-conversation {
    min-width: 0;
    border: 1px solid var(--line-soft);
    border-radius: 6px;
    background: var(--surface);
    box-shadow: none;
    overflow: hidden;
  }
  .conversation-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    padding: 19px 19px 15px;
    border-bottom: 1px solid var(--wash);
  }
  .conversation-eyebrow {
    color: var(--muted);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.11em;
  }
  h2 {
    margin: 6px 0 0;
    color: var(--ink);
    font-size: 16px;
    line-height: 1.3;
    font-weight: 650;
    letter-spacing: -0.03em;
  }
  .demo-badge {
    flex-shrink: 0;
    padding: 4px 7px;
    border: 1px solid var(--line-soft);
    border-radius: 6px;
    background: var(--wash);
    color: var(--muted);
    font-size: 10px;
    font-weight: 600;
  }
  .conversation-thread {
    padding: 18px 18px 15px;
  }
  .agent-message {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .agent-avatar {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    border-radius: 8px;
    background: var(--ink);
    color: var(--highlight);
  }
  .message-content {
    min-width: 0;
    flex: 1;
  }
  .message-meta {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 6px;
    min-height: 23px;
  }
  .message-meta strong {
    color: var(--ink);
    font-size: 11px;
    font-weight: 650;
  }
  .message-meta span {
    color: var(--muted);
    font-size: 9px;
  }
  .message-content p {
    margin: 1px 0 0;
    color: var(--muted);
    font-size: 11px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
  .message-content p strong {
    color: var(--ink);
    font-weight: 600;
  }
  .evidence-reference {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    width: fit-content;
    max-width: 100%;
    margin-top: 11px;
    padding: 7px 8px;
    border: 1px solid var(--line-soft);
    border-radius: 8px;
    background: var(--wash);
    color: var(--muted);
    font-size: 10px;
  }
  .evidence-reference svg {
    color: var(--muted);
  }
  .evidence-extra {
    padding-left: 5px;
    border-left: 1px solid var(--line-soft);
  }
  .conversation-event {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    margin: 18px 0 16px 38px;
    padding-left: 12px;
    border-left: 1px solid var(--line-soft);
  }
  .event-icon {
    display: grid;
    place-items: center;
    width: 17px;
    height: 17px;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--highlight);
    color: var(--ink);
    font-size: 10px;
  }
  .conversation-event strong,
  .conversation-event span:last-child {
    display: block;
  }
  .conversation-event strong {
    color: var(--ink);
    font-size: 10px;
    font-weight: 650;
  }
  .conversation-event span:last-child {
    margin-top: 2px;
    color: var(--muted);
    font-size: 9px;
  }
  .task-card {
    margin: 0 0 20px 38px;
    padding: 12px;
    border: 1px solid var(--line-soft);
    border-radius: 10px;
    background: var(--wash);
  }
  .task-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 7px;
    color: var(--muted);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
  }
  .task-status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    border-radius: 5px;
    background: var(--highlight);
    color: var(--ink);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0;
    white-space: nowrap;
  }
  .task-status span {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
  }
  .task-title {
    display: block;
    margin-top: 9px;
    color: var(--ink);
    font-size: 11px;
    line-height: 1.45;
    font-weight: 650;
    overflow-wrap: anywhere;
  }
  .task-id {
    display: block;
    margin-top: 3px;
    color: var(--muted);
    font-size: 9px;
  }
  .task-steps {
    display: grid;
    gap: 7px;
    margin-top: 12px;
    padding-top: 11px;
    border-top: 1px solid var(--line-soft);
    color: var(--muted);
    font-size: 10px;
  }
  .task-steps > span {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .step-done {
    display: grid;
    place-items: center;
    width: 14px;
    height: 14px;
    border-radius: 4px;
    background: var(--highlight);
    color: var(--ink);
    font-size: 9px;
  }
  .step-current {
    box-sizing: border-box;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    border: 2px solid var(--line-soft);
    border-top-color: var(--ink);
    border-radius: 50%;
    animation: investigation-spin 900ms linear infinite;
  }
  @keyframes investigation-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .step-current {
      animation: none;
    }
  }
  .last-message {
    padding-top: 16px;
    border-top: 1px solid var(--wash);
  }
  .conversation-disclaimer {
    margin: 0;
    padding: 11px 18px;
    border-top: 1px solid var(--wash);
    background: var(--wash);
    color: var(--muted);
    font-size: 9px;
    line-height: 1.4;
  }
</style>
