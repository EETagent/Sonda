<script lang="ts">
  import type { HandoffDestination } from "$lib/handoff";
  let { name }: { name: HandoffDestination } = $props();
</script>

<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  {#if name === "cursor"}
    <path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z" fill="currentColor" />
    <path d="m5 8 7 4 7-4M12 12v8" stroke="white" stroke-width="1.2" />
    <path d="m5 8 10 8-3-4 7-4H5Z" fill="white" />
  {:else if name === "slack"}
    <rect x="9" y="2" width="4" height="10" rx="2" fill="#36c5f0" />
    <circle cx="6" cy="10" r="2" fill="#36c5f0" />
    <rect x="12" y="9" width="10" height="4" rx="2" fill="#2eb67d" />
    <circle cx="14" cy="6" r="2" fill="#2eb67d" />
    <rect x="11" y="12" width="4" height="10" rx="2" fill="#ecb22e" />
    <circle cx="18" cy="14" r="2" fill="#ecb22e" />
    <rect x="2" y="11" width="10" height="4" rx="2" fill="#e01e5a" />
    <circle cx="10" cy="18" r="2" fill="#e01e5a" />
  {:else if name === "linear"}
    <circle cx="12" cy="12" r="10" fill="#5e6ad2" />
    <path d="m5 14 5 5m-6-9 10 10M6 6l12 12M10 4l10 10" stroke="white" stroke-width="1.5" />
  {:else}
    <path
      fill="currentColor"
      d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.64-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.28.1-2.66 0 0 .84-.27 2.75 1.03A9.6 9.6 0 0 1 12 6.82a9.6 9.6 0 0 1 2.5.34c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.41.1 2.66.64.7 1.03 1.6 1.03 2.69 0 3.84-2.33 4.69-4.56 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"
    />
  {/if}
</svg>
