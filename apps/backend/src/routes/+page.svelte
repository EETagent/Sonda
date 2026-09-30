<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import SubmissionForm from "$lib/components/SubmissionForm.svelte";
  import { artifactUrl, formatDuration, type Submission } from "$lib/submissions";

  let { data }: { data: { submissions: Submission[] } } = $props();
  const showForm = $derived(page.url.searchParams.has("new"));
  const latest = $derived(data.submissions[0]);
  const replayCount = $derived(data.submissions.filter((report) => report.replay).length);
  const screenshotOnlyCount = $derived(
    data.submissions.filter((report) => report.screenshot && !report.replay).length,
  );
</script>

<svelte:head><title>{showForm ? "New capture" : "Workspace"} · Sonda</title></svelte:head>

{#if showForm}
  <div class="new-report-page">
    <SubmissionForm
      oncancel={() => {
        void goto("/");
      }}
    />
  </div>
{:else}
  <div class="workspace-home">
    <section class="workspace-hero" aria-labelledby="welcome-heading">
      <div class="workspace-hero-copy">
        <span class="workspace-eyebrow">SONDA / CAPTURE DESK</span>
        <h1 id="welcome-heading">The evidence comes first.</h1>
        <p>Review the capture. Trace the interaction. Give an agent a precise task.</p>
        <div class="workspace-hero-actions">
          {#if latest}<a class="button button-primary" href={`/submissions/${latest.id}`}>
              Open latest capture <span aria-hidden="true">↗</span></a
            >{/if}
          <a class="button button-secondary" href="/?new=1"
            ><span aria-hidden="true">+</span> New capture</a
          >
        </div>
      </div>
    </section>

    <div class="workspace-metrics" aria-label="Workspace summary">
      <div><strong>{data.submissions.length}</strong><span>Total captures</span></div>
      <div><strong>{replayCount}</strong><span>With session replay</span></div>
      <div><strong>{screenshotOnlyCount}</strong><span>Screenshot only</span></div>
    </div>

    <div class="workspace-content-grid">
      <section class="workspace-recent" aria-labelledby="recent-heading">
        <div class="workspace-section-heading">
          <div>
            <span class="workspace-section-kicker">01 / INBOX</span>
            <h2 id="recent-heading">Recent captures</h2>
          </div>
          <span>{data.submissions.length} total</span>
        </div>
        {#if data.submissions.length}
          <div class="workspace-recent-list">
            {#each data.submissions.slice(0, 5) as report (report.id)}
              <a class="workspace-recent-row" href={`/submissions/${report.id}`}>
                <span class="workspace-recent-icon" aria-hidden="true"
                  ><svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                    ><rect x="3" y="3" width="18" height="18" rx="3" /><path
                      d="m3 17 5-5 4 4 4-6 5 5"
                    /></svg
                  ></span
                >
                <span class="workspace-recent-copy"
                  ><strong>{report.title}</strong><small
                    >{report.screenshot ? "Screenshot" : "Replay"}{report.replay &&
                    report.screenshot
                      ? " · Session replay"
                      : report.replay
                        ? ` · ${formatDuration(report.replay.durationMs)}`
                        : ""}</small
                  ></span
                >
                <span class="workspace-recent-arrow" aria-hidden="true">↗</span>
              </a>
            {/each}
          </div>
        {:else}
          <div class="workspace-empty">
            <strong>No captures yet</strong>
            <p>Add a screenshot or replay to prepare your first agent handoff.</p>
            <a href="/?new=1">Add a capture <span aria-hidden="true">↗</span></a>
          </div>
        {/if}
      </section>

      <section class="workspace-next" aria-labelledby="next-heading">
        <span class="workspace-section-kicker">02 / LATEST CAPTURE</span>
        <h2 id="next-heading">{latest ? "On the desk" : "Nothing on the desk yet"}</h2>
        <p>
          {latest
            ? "Open the evidence and prepare the next step."
            : "Once you add evidence, you can turn it into a focused task for an agent or teammate."}
        </p>
        {#if latest}
          {#if latest.screenshot}
            <a
              class="desk-preview"
              href={`/submissions/${latest.id}`}
              aria-label={`Review ${latest.title}`}
            >
              <img
                src={artifactUrl(latest.id, "screenshot")}
                alt={`Capture of ${latest.title}`}
                loading="lazy"
              />
              <span>{latest.screenshot.width} × {latest.screenshot.height} / PNG</span>
            </a>
          {/if}
          <div class="workspace-next-report">
            <strong>{latest.title}</strong><small
              >{latest.screenshot ? "Screenshot" : ""}{latest.screenshot && latest.replay
                ? " + "
                : ""}{latest.replay ? "Session replay" : ""} attached</small
            >
          </div>
          <a class="workspace-next-link" href={`/submissions/${latest.id}`}
            >Open agent workspace <span aria-hidden="true">↗</span></a
          >
        {:else}
          <a class="workspace-next-link" href="/?new=1"
            >Create first capture <span aria-hidden="true">↗</span></a
          >
        {/if}
        <small class="workspace-next-note"
          >Handoffs are prepared as previews and are not sent.</small
        >
      </section>
    </div>
    <div class="workspace-api-hint">
      <span aria-hidden="true">⌘</span> Sending from your app? Use <code>POST /api/v1/submit</code> to
      attach PNG and rrweb data.
    </div>
  </div>
{/if}
