<script lang="ts">
  const workspaces = [
    { id: "sonda", name: "Sonda Demo", detail: "Preview workspace", mark: "S", tone: "sonda" },
    { id: "acme", name: "Acme Studio", detail: "Team preview", mark: "A", tone: "acme" },
    {
      id: "sandbox",
      name: "Personal Sandbox",
      detail: "Private preview",
      mark: "P",
      tone: "sandbox",
    },
  ] as const;

  type Workspace = (typeof workspaces)[number];

  let selected = $state<Workspace>(workspaces[0]);
  let open = $state(false);
  let root: HTMLDivElement;
  let trigger: HTMLButtonElement;

  function choose(workspace: Workspace) {
    selected = workspace;
    open = false;
    trigger.focus();
  }

  function handlePointerDown(event: PointerEvent) {
    if (open && root && !root.contains(event.target as Node)) open = false;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (open && event.key === "Escape") {
      open = false;
      trigger.focus();
    }
  }
</script>

<svelte:window onpointerdown={handlePointerDown} onkeydown={handleKeyDown} />

<div class="workspace-switcher" bind:this={root}>
  <button
    bind:this={trigger}
    class="switcher-trigger"
    class:open
    type="button"
    aria-expanded={open}
    aria-controls={open ? "workspace-switcher-options" : undefined}
    aria-label={`Workspace: ${selected.name}. Switch preview workspace`}
    onclick={() => (open = !open)}
  >
    <span class={`switcher-avatar ${selected.tone}`} aria-hidden="true">{selected.mark}</span>
    <span class="switcher-current"
      ><strong>{selected.name}</strong><small>{selected.detail}</small></span
    >
    <svg
      class="switcher-chevrons"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      aria-hidden="true"><path d="m7 10 5-5 5 5M7 14l5 5 5-5" /></svg
    >
  </button>

  {#if open}
    <div
      class="switcher-popover"
      id="workspace-switcher-options"
      role="group"
      aria-label="Preview workspaces"
    >
      <div class="switcher-menu-label">SWITCH WORKSPACE</div>
      {#each workspaces as workspace (workspace.id)}
        <button
          class="switcher-option"
          class:selected={selected.id === workspace.id}
          type="button"
          aria-pressed={selected.id === workspace.id}
          onclick={() => choose(workspace)}
        >
          <span class={`switcher-avatar ${workspace.tone}`} aria-hidden="true"
            >{workspace.mark}</span
          >
          <span class="switcher-option-copy"
            ><strong>{workspace.name}</strong><small>{workspace.detail}</small></span
          >
          {#if selected.id === workspace.id}<svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg
            >{/if}
        </button>
      {/each}
      <p class="switcher-note">Preview only. All captures remain visible.</p>
    </div>
  {/if}
</div>

<style>
  .workspace-switcher {
    position: relative;
    z-index: 10;
    flex-shrink: 0;
    padding: 0 12px 14px;
  }
  .switcher-trigger {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 57px;
    padding: 7px 9px;
    border: 1px solid var(--line-soft);
    border-radius: 10px;
    background: var(--surface);
    color: var(--ink);
    text-align: left;
    box-shadow: 0 1px 3px #16161608;
  }
  .switcher-trigger.open {
    border-color: var(--ink);
    box-shadow: 0 0 0 3px #16161618;
  }
  .switcher-avatar {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    border-radius: 8px;
    color: var(--surface);
    font-size: 14px;
    font-weight: 700;
    letter-spacing: -0.04em;
  }
  .switcher-avatar.sonda {
    background: var(--ink);
  }
  .switcher-avatar.acme {
    background: var(--muted);
  }
  .switcher-avatar.sandbox {
    background: var(--muted);
  }
  .switcher-current,
  .switcher-option-copy {
    display: grid;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }
  .switcher-current strong,
  .switcher-option-copy strong {
    overflow: hidden;
    font-size: 12px;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .switcher-current small,
  .switcher-option-copy small {
    color: var(--muted);
    font-size: 10px;
  }
  .switcher-chevrons {
    color: var(--muted);
  }
  .switcher-popover {
    position: absolute;
    top: calc(100% - 9px);
    right: 12px;
    left: 12px;
    z-index: 20;
    padding: 7px;
    border: 1px solid var(--line-soft);
    border-radius: 6px;
    background: var(--surface);
    box-shadow:
      0 16px 40px #16161630,
      0 2px 8px #16161610;
  }
  .switcher-menu-label {
    padding: 8px 8px 6px;
    color: var(--muted);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
  }
  .switcher-option {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    min-height: 49px;
    padding: 7px 8px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--ink);
    text-align: left;
  }
  .switcher-option.selected {
    background: var(--highlight);
  }
  .switcher-option .switcher-avatar {
    width: 30px;
    height: 30px;
    border-radius: 7px;
    font-size: 12px;
  }
  .switcher-option svg {
    color: var(--muted);
  }
  .switcher-note {
    margin: 6px 3px 2px;
    padding: 10px 7px 5px;
    border-top: 1px solid var(--wash);
    color: var(--muted);
    font-size: 10px;
    line-height: 1.4;
  }
  @media (hover: hover) and (pointer: fine) {
    .switcher-trigger:hover,
    .switcher-option:hover {
      background: var(--wash);
    }
    .switcher-option.selected:hover {
      background: var(--highlight-hover);
    }
  }
</style>
