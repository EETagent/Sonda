<script lang="ts">
  import { goto } from "$app/navigation";
  import type { Submission } from "$lib/submissions";

  let { report }: { report: Submission } = $props();
  let deleting = $state(false);
  let error = $state("");

  async function deleteCapture() {
    if (
      deleting ||
      !window.confirm(`Delete “${report.title}” and its attachments? This cannot be undone.`)
    )
      return;
    deleting = true;
    error = "";
    try {
      const response = await fetch(`/api/v1/submissions/${report.id}`, { method: "DELETE" });
      if (!response.ok && response.status !== 404) throw new Error("Delete failed");
    } catch {
      error = "Could not delete this capture. Please try again.";
      deleting = false;
      return;
    }
    await goto("/", { invalidateAll: true });
  }
</script>

<div class="delete-capture">
  <button type="button" disabled={deleting} onclick={deleteCapture}>
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      aria-hidden="true"
    >
      <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
    </svg>
    {deleting ? "Deleting…" : "Delete capture"}
  </button>
  {#if error}<span role="alert">{error}</span>{/if}
</div>

<style>
  .delete-capture {
    margin-left: auto;
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  button:hover {
    color: #b42318;
    background: #fff1f0;
    border-color: #fecaca;
  }
  button:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  [role="alert"] {
    display: block;
    color: #b42318;
  }
</style>
