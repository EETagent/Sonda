<script lang="ts">
  let { src, alt, width, height }: { src: string; alt: string; width: number; height: number } =
    $props();
  let loaded = $state(false);
  let failed = $state(false);
  let attempt = $state(0);

  function retry() {
    loaded = false;
    failed = false;
    attempt++;
  }
</script>

<div class="screenshot-stage" class:image-loading={!loaded && !failed}>
  {#key attempt}
    <img
      {src}
      {alt}
      {width}
      {height}
      onload={() => {
        loaded = true;
      }}
      onerror={() => {
        failed = true;
      }}
    />
  {/key}
  {#if failed}
    <div class="image-message" role="alert">
      <p>The screenshot could not be loaded.</p>
      <button class="button button-secondary" type="button" onclick={retry}>Try again</button>
    </div>
  {:else if !loaded}
    <span class="image-message" role="status">Loading screenshot…</span>
  {/if}
</div>
