<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import DeleteCapture from "$lib/components/DeleteCapture.svelte";
  import ScreenshotPreview from "$lib/components/ScreenshotPreview.svelte";
  import ReplayPlayer from "$lib/components/ReplayPlayer.svelte";
  import AgentHandoff from "$lib/components/AgentHandoff.svelte";
  import MockAgentConversation from "$lib/components/MockAgentConversation.svelte";
  import {
    artifactUrl,
    formatBytes,
    formatDuration,
    type ArtifactKind,
    type Submission,
  } from "$lib/submissions";

  let { data }: { data: { submission: Submission } } = $props();
  const report = $derived(data.submission);
  const active = $derived<ArtifactKind>(
    page.url.searchParams.get("view") === "replay" && report.replay
      ? "replay"
      : report.screenshot
        ? "screenshot"
        : "replay",
  );
  const created = $derived(
    new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(new Date(report.createdAt)),
  );

  function selectView(view: ArtifactKind, focus = false) {
    const url = new URL(page.url);
    if (view === "replay") url.searchParams.set("view", "replay");
    else url.searchParams.delete("view");
    void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
    if (focus) document.getElementById(`tab-${view}`)?.focus();
  }

  function tabKey(event: KeyboardEvent) {
    if (
      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) ||
      !report.screenshot ||
      !report.replay
    )
      return;
    event.preventDefault();
    selectView(
      event.key === "Home"
        ? "screenshot"
        : event.key === "End"
          ? "replay"
          : active === "screenshot"
            ? "replay"
            : "screenshot",
      true,
    );
  }
</script>

<svelte:head><title>{report.title} · Sonda</title></svelte:head>

<article class="report-detail">
  <div class="report-context">
    <span class="status-chip"><span class="status-dot" aria-hidden="true"></span>Submitted</span
    ><time datetime={report.createdAt}>{created} UTC</time><span class="report-short-id"
      >#{report.id.slice(0, 8)}</span
    >
    {#key report.id}<DeleteCapture {report} />{/key}
  </div>
  <header class="report-heading">
    <h1>{report.title}</h1>
    {#if report.description}<p>{report.description}</p>{/if}
  </header>
  {#if report.url}<a class="source-link" href={report.url} target="_blank" rel="noreferrer"
      ><svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        aria-hidden="true"
        ><path
          d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"
        /></svg
      ><span>{report.url}</span></a
    >{/if}

  <div class="report-workspace">
    <div class="report-primary">
      <section class="evidence" aria-label="Report evidence">
        <div class="evidence-toolbar">
          <div class="evidence-tabs" role="tablist" aria-label="Capture type">
            {#if report.screenshot}<button
                id="tab-screenshot"
                class:active={active === "screenshot"}
                type="button"
                role="tab"
                aria-selected={active === "screenshot"}
                aria-controls="evidence-panel"
                tabindex={active === "screenshot" ? 0 : -1}
                onclick={() => selectView("screenshot")}
                onkeydown={tabKey}
                ><svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  aria-hidden="true"
                  ><rect x="3" y="3" width="18" height="18" rx="3" /><path
                    d="m3 17 5-5 4 4 4-6 5 5"
                  /></svg
                >Screenshot</button
              >{/if}
            {#if report.replay}<button
                id="tab-replay"
                class:active={active === "replay"}
                type="button"
                role="tab"
                aria-selected={active === "replay"}
                aria-controls="evidence-panel"
                tabindex={active === "replay" ? 0 : -1}
                onclick={() => selectView("replay")}
                onkeydown={tabKey}
                ><svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  aria-hidden="true"><path d="m8 4 12 8-12 8V4Z" /></svg
                >Session replay</button
              >{/if}
          </div>
          <a
            class="evidence-download"
            href={`${artifactUrl(report.id, active)}?download=1`}
            download
            ><svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg
            >Download {active === "screenshot" ? "PNG" : "JSON"}</a
          >
        </div>
        <div id="evidence-panel" role="tabpanel" aria-labelledby={`tab-${active}`} tabindex="0">
          {#if active === "screenshot" && report.screenshot}
            {#key report.id}
              <ScreenshotPreview
                src={artifactUrl(report.id, "screenshot")}
                alt={`Screenshot attached to ${report.title}`}
                width={report.screenshot.width}
                height={report.screenshot.height}
              />
            {/key}
          {:else if report.replay}
            {#key report.id}<ReplayPlayer src={artifactUrl(report.id, "replay")} />{/key}
          {/if}
        </div>
        <div class="evidence-caption">
          <span
            >{active === "screenshot" && report.screenshot
              ? `${report.screenshot.width} × ${report.screenshot.height} pixels`
              : report.replay
                ? `${formatDuration(report.replay.durationMs)} · ${report.replay.eventCount.toLocaleString("en")} events`
                : ""}</span
          ><span>{active === "screenshot" ? "PNG screenshot" : "rrweb recording · no audio"}</span>
        </div>
      </section>

      <section class="report-information" aria-labelledby="details-heading">
        <h2 id="details-heading">Report details</h2>
        <dl class="metadata-grid">
          <div>
            <dt>Received</dt>
            <dd>{created} UTC</dd>
          </div>
          <div>
            <dt>Attachments</dt>
            <dd>
              {[report.screenshot ? "Screenshot" : "", report.replay ? "Session replay" : ""]
                .filter(Boolean)
                .join(" + ")}
            </dd>
          </div>
          {#if report.screenshot}<div>
              <dt>Screenshot</dt>
              <dd>
                {formatBytes(report.screenshot.bytes)} · {report.screenshot.width} × {report
                  .screenshot.height}
              </dd>
            </div>{/if}
          {#if report.replay}<div>
              <dt>Recording</dt>
              <dd>
                {formatBytes(report.replay.bytes)} · {report.replay.eventCount.toLocaleString("en")} events{report
                  .replay.rrwebVersion
                  ? ` · rrweb ${report.replay.rrwebVersion}`
                  : ""}
              </dd>
            </div>{/if}
        </dl>
        {#if Object.keys(report.metadata).length}<details class="additional-metadata">
            <summary>Capture metadata</summary>
            <pre>{JSON.stringify(report.metadata, null, 2)}</pre>
          </details>{/if}
      </section>
    </div>
    <aside class="report-agent-panel" aria-label="Agent workspace">
      {#key report.id}
        <AgentHandoff {report} />
      {/key}
    </aside>
    <div class="report-conversation-panel">
      {#key report.id}<MockAgentConversation {report} />{/key}
    </div>
  </div>
  <p class="report-footnote">
    <span>Stored on this server</span><span>Report #{report.id.slice(0, 8)}</span>
  </p>
</article>
