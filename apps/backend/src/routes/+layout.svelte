<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import { afterNavigate } from "$app/navigation";
  import { assets } from "$app/paths";
  import type { Snippet } from "svelte";
  import { formatDuration, type Submission } from "$lib/submissions";
  import WorkspaceSwitcher from "$lib/components/WorkspaceSwitcher.svelte";

  let { children, data }: { children: Snippet; data: { submissions: Submission[] } } = $props();
  let search = $state("");
  let mobileInbox = $state(false);
  const isSettings = $derived(page.url.pathname === "/settings");
  const isOverview = $derived(page.url.pathname === "/" && !page.url.searchParams.has("new"));
  const reports = $derived(data.submissions ?? []);
  const visible = $derived(
    reports.filter((report) =>
      `${report.title} ${report.description} ${report.url ?? ""}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    ),
  );
  const selected = $derived(reports.find((report) => report.id === page.params.id));
  afterNavigate(() => {
    mobileInbox = false;
  });

  function shortDate(value: string) {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(value));
  }
</script>

<svelte:head>
  <link rel="icon" type="image/png" href="{assets}/sonda-probe.png" />
  <meta name="theme-color" content="#ffffff" />
  <meta
    name="description"
    content="Sonda's local workspace for capture evidence and agent handoffs."
  />
</svelte:head>

<a class="skip-link" href="#main-content">Skip to report</a>
<div class="admin-shell">
  <aside class="inbox-sidebar" class:mobile-open={mobileInbox} aria-label="Workspace navigation">
    <div class="sidebar-brand-row">
      <a class="brand" href="/" aria-label="Sonda workspace">
        <img class="brand-icon" src="{assets}/sonda-probe.png" alt="" width="30" height="30" />
        sonda<span class="brand-label">workspace</span>
      </a>
      <a class="icon-button" href="/?new=1" aria-label="New capture" title="New capture"
        ><svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
        ></a
      >
    </div>
    <WorkspaceSwitcher />
    <div class="sidebar-content" id="sidebar-content">
      <nav class="workspace-nav" aria-label="Workspace">
        <a class:active={isOverview} href="/" aria-current={isOverview ? "page" : undefined}>
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            aria-hidden="true"
            ><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect
              x="14"
              y="3"
              width="7"
              height="7"
              rx="1.5"
            /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect
              x="14"
              y="14"
              width="7"
              height="7"
              rx="1.5"
            /></svg
          >
          <span>Overview</span>
        </a>
        <a
          class:active={page.url.searchParams.has("new")}
          href="/?new=1"
          aria-current={page.url.searchParams.has("new") ? "page" : undefined}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            aria-hidden="true"><path d="M12 3v18M3 12h18" /></svg
          >
          <span>New capture</span>
        </a>
        <a
          href="/settings"
          class:active={isSettings}
          aria-current={isSettings ? "page" : undefined}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            aria-hidden="true"
            ><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="var(--wash)" /><circle
              cx="15"
              cy="17"
              r="3"
              fill="var(--wash)"
            /></svg
          >
          <span>Settings</span>
        </a>
      </nav>
      <div class="sidebar-search">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg
        >
        <label class="sr-only" for="report-search">Search reports</label>
        <input id="report-search" type="search" placeholder="Search captures" bind:value={search} />
      </div>
      <div class="sidebar-list-heading"><span>CAPTURES</span><span>{reports.length}</span></div>
      <nav class="report-list" aria-label="Submissions">
        {#each visible as report (report.id)}
          <a
            class="report-row"
            class:selected={page.params.id === report.id}
            href={`/submissions/${report.id}`}
            aria-current={page.params.id === report.id ? "page" : undefined}
          >
            <span class="report-avatar" class:replay-avatar={!report.screenshot} aria-hidden="true">
              {#if report.screenshot}<svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  ><rect x="3" y="3" width="18" height="18" rx="4" /><circle
                    cx="8"
                    cy="8"
                    r="1.5"
                  /><path d="m3 17 5-5 4 4 4-6 5 5" /></svg
                >{:else}<svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"><path d="m8 5 11 7-11 7V5Z" /></svg
                >{/if}
            </span>
            <span class="report-row-copy"
              ><span class="report-row-title">{report.title}</span><span class="report-row-caption"
                >{report.screenshot ? "Screenshot" : "Session replay"}{report.screenshot &&
                report.replay
                  ? " + replay"
                  : report.replay
                    ? ` · ${formatDuration(report.replay.durationMs)}`
                    : ""}</span
              ></span
            >
            <time datetime={report.createdAt}>{shortDate(report.createdAt)}</time>
          </a>
        {:else}
          <p class="sidebar-empty">
            {search ? "No matching captures." : "Your captures will appear here."}
          </p>
        {/each}
      </nav>
    </div>
  </aside>

  <div class="main-pane">
    <header class="pane-header">
      <button
        class="icon-button mobile-inbox-toggle"
        type="button"
        aria-label="Toggle report inbox"
        aria-expanded={mobileInbox}
        aria-controls="sidebar-content"
        onclick={() => (mobileInbox = !mobileInbox)}
        ><svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          aria-hidden="true"
          ><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></svg
        ></button
      >
      <span class="pane-title"
        ><span class="pane-title-prefix">{selected ? "Capture" : "Workspace"}</span><span
          class="pane-title-divider"
          aria-hidden="true">/</span
        >{selected
          ? selected.title
          : isSettings
            ? "Settings"
            : page.url.searchParams.has("new")
              ? "New capture"
              : "Overview"}</span
      >
      <span class="pane-header-label"
        ><span class="status-dot" aria-hidden="true"></span> LOCAL WORKSPACE</span
      >
    </header>
    <main id="main-content" class="content-scroll" tabindex="-1">{@render children()}</main>
  </div>
</div>
