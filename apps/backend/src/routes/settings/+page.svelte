<script lang="ts">
  import { onMount } from "svelte";
  import DestinationIcon from "$lib/components/DestinationIcon.svelte";
  import type { HandoffDestination } from "$lib/handoff";

  const integrations: Array<{
    id: HandoffDestination;
    name: string;
    description: string;
    destination: string;
  }> = [
    {
      id: "github",
      name: "GitHub",
      description:
        "Bring repository context into investigations and prepare issues for your engineering team.",
      destination: "Repositories & issues",
    },
    {
      id: "linear",
      name: "Linear",
      description:
        "Turn captured issues into tasks with reproduction steps and the evidence attached.",
      destination: "Issues & projects",
    },
    {
      id: "cursor",
      name: "Cursor Agent",
      description: "Give an agent the report context to investigate the cause and propose a fix.",
      destination: "Agent investigations",
    },
    {
      id: "slack",
      name: "Slack",
      description: "Share report summaries and investigation updates with your team.",
      destination: "Channels & updates",
    },
  ];
  const storageKey = "sonda:mock-connections:v1";
  let connected = $state<HandoffDestination[]>([]);
  let ready = $state(false);
  let feedback = $state("");

  onMount(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(saved)) {
        connected = integrations.filter((item) => saved.includes(item.id)).map((item) => item.id);
      }
    } catch {
      feedback =
        "Saved preview settings could not be loaded. You can still try the connections below.";
    }
    ready = true;
  });

  function toggle(id: HandoffDestination, name: string) {
    const disconnecting = connected.includes(id);
    connected = disconnecting ? connected.filter((item) => item !== id) : [...connected, id];
    feedback = `${name} ${disconnecting ? "disconnected from" : "connected in"} the demo.`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(connected));
    } catch {
      feedback +=
        " This change will last until you leave this page; browser storage is unavailable.";
    }
  }
</script>

<svelte:head><title>Settings · Sonda</title></svelte:head>

<div class="settings-page">
  <header class="settings-heading">
    <span class="settings-eyebrow">WORKSPACE / SETTINGS</span>
    <h1>Connections</h1>
    <p>Choose where your captures go next.</p>
  </header>

  <div class="preview-notice">
    <span class="preview-label">DEMO</span>
    <p>
      Try connecting your tools. These are mock connections saved in this browser; no accounts are
      authorized and no data is sent.
    </p>
  </div>

  <section aria-labelledby="integrations-heading">
    <div class="integrations-heading">
      <h2 id="integrations-heading">Available integrations</h2>
      <span>{connected.length} / {integrations.length} connected in demo</span>
    </div>
    <div class="integration-list">
      {#each integrations as integration (integration.id)}
        {@const isConnected = connected.includes(integration.id)}
        <article class="integration-row">
          <span class="integration-icon"><DestinationIcon name={integration.id} /></span>
          <div class="integration-copy">
            <div class="integration-title">
              <h3>{integration.name}</h3>
              {#if isConnected}<span class="connection-status">✓ Demo connected</span>{/if}
            </div>
            <p>{integration.description}</p>
            <span class="integration-destination">{integration.destination}</span>
          </div>
          <button
            type="button"
            class="button"
            class:button-primary={!isConnected}
            class:button-secondary={isConnected}
            disabled={!ready}
            aria-label={`${isConnected ? "Disconnect" : "Connect"} ${integration.name} demo`}
            onclick={() => toggle(integration.id, integration.name)}
            >{isConnected ? "Disconnect" : "Connect"}<span aria-hidden="true"
              >{isConnected ? "−" : "+"}</span
            ></button
          >
        </article>
      {/each}
    </div>
  </section>
  <p class="settings-feedback" role="status" aria-live="polite">{feedback}</p>
  <p class="settings-footnote">
    Preview settings apply to this browser across all mock workspaces.
  </p>
</div>

<style>
  .settings-page {
    max-width: 1120px;
    margin: 0 auto;
    padding: 48px 40px 32px;
  }
  .settings-heading {
    padding-bottom: 26px;
    border-bottom: 2px solid var(--ink);
  }
  .settings-eyebrow {
    font:
      10px ui-monospace,
      monospace;
    letter-spacing: 0.1em;
    color: var(--muted);
  }
  h1 {
    margin: 14px 0 8px;
    font-size: 36px;
    line-height: 1.1;
    font-weight: 550;
    letter-spacing: -0.04em;
  }
  .settings-heading p {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
  }
  .preview-notice {
    display: flex;
    align-items: baseline;
    gap: 14px;
    padding: 18px 0;
    border-bottom: 1px solid var(--line-soft);
  }
  .preview-label {
    flex-shrink: 0;
    padding: 3px 6px;
    background: var(--highlight);
    color: var(--ink);
    font:
      10px ui-monospace,
      monospace;
  }
  .preview-notice p {
    max-width: 660px;
    margin: 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.6;
  }
  .integrations-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin: 32px 0 14px;
  }
  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .integrations-heading > span {
    color: var(--muted);
    font:
      10px ui-monospace,
      monospace;
  }
  .integration-list {
    border-top: 1px solid var(--ink);
  }
  .integration-row {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    align-items: start;
    gap: 18px;
    padding: 26px 0;
    border-bottom: 1px solid var(--line-soft);
  }
  .integration-icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 1px solid var(--line-soft);
    background: var(--surface);
    border-radius: 5px;
  }
  .integration-copy {
    min-width: 0;
  }
  .integration-title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 650;
  }
  .connection-status {
    padding: 2px 6px;
    background: var(--highlight);
    color: var(--ink);
    font-size: 10px;
  }
  .integration-copy p {
    max-width: 560px;
    margin: 7px 0 9px;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.6;
  }
  .integration-destination {
    font:
      10px ui-monospace,
      monospace;
    color: var(--muted);
  }
  .integration-row button {
    min-width: 112px;
    gap: 18px;
    justify-content: space-between;
  }
  .settings-feedback {
    min-height: 20px;
    margin: 17px 0 0;
    color: var(--ink);
    font-size: 12px;
  }
  .settings-footnote {
    margin: 18px 0 0;
    color: var(--muted);
    font-size: 10px;
  }
  @media (max-width: 700px) {
    .settings-page {
      padding: 26px 16px;
    }
    h1 {
      font-size: 30px;
    }
    .integrations-heading {
      align-items: start;
      flex-direction: column;
      gap: 5px;
    }
    .integration-row {
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 12px;
    }
    .integration-icon {
      width: 34px;
      height: 34px;
    }
    .integration-row button {
      grid-column: 2;
      justify-self: start;
    }
  }
</style>
