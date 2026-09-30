<script lang="ts">
  import { page } from "$app/state";
</script>

<svelte:head
  ><title>{page.status === 404 ? "Not found" : "Something went wrong"} · Sonda</title></svelte:head
>

<section class="error-page" aria-labelledby="error-heading">
  <a class="back-link" href="/"
    ><svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"><path d="M19 12H5m5-5-5 5 5 5" /></svg
    >Back to inbox</a
  >
  <div class="error-page-card">
    <span class="error-code">{page.status}</span>
    <p class="eyebrow">A LITTLE CONTEXT IS MISSING</p>
    <h1 id="error-heading">
      {page.status === 404 ? "Nothing to see here." : "Something went off track."}
    </h1>
    <p>
      {page.status === 404
        ? "This page or submission could not be found. Check the link, or head back to your inbox."
        : page.error?.message || "We couldn’t load this page. Please try again in a moment."}
    </p>
    <a class="button button-primary" href="/">Return to inbox <span aria-hidden="true">↗</span></a>
  </div>
</section>
