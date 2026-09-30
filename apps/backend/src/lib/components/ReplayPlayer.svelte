<script lang="ts">
  import { onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import type { Replayer } from "@rrweb/replay";
  import type { eventWithTime } from "@rrweb/types";
  import "@rrweb/replay/dist/style.css";
  import { formatDuration } from "$lib/submissions";

  let { src }: { src: string } = $props();
  let stage: HTMLDivElement;
  let container: HTMLElement;
  let fullscreen = $state(false);
  let fullscreenFailure = $state("");
  let loading = $state(true);
  let failure = $state("");
  let ready = $state(false);
  let playing = $state(false);
  let elapsed = $state(0);
  let duration = $state(0);
  let speed = $state(1);
  let aspectRatio = $state("16 / 10");
  let player: Replayer | undefined;
  let animationFrame = 0;
  let observer: ResizeObserver | undefined;
  let request: AbortController | undefined;
  let generation = 0;
  let disposed = false;
  let snapshotOffset = 0;

  function cleanup() {
    cancelAnimationFrame(animationFrame);
    observer?.disconnect();
    observer = undefined;
    player?.destroy();
    player = undefined;
    request?.abort();
    request = undefined;
    ready = false;
    playing = false;
  }

  function fit() {
    if (!player || !stage) return;
    const width = Number(player.iframe.width);
    const height = Number(player.iframe.height);
    if (!width || !height) return;
    aspectRatio = `${width} / ${height}`;
    const scale = Math.min(stage.clientWidth / width, stage.clientHeight / height, 1);
    Object.assign(player.wrapper.style, {
      position: "absolute",
      transformOrigin: "top left",
      transform: `scale(${scale})`,
      left: `${(stage.clientWidth - width * scale) / 2}px`,
      top: `${(stage.clientHeight - height * scale) / 2}px`,
    });
  }

  function trackTime() {
    if (!player || !playing) return;
    elapsed = Math.max(0, Math.min(duration, player.getCurrentTime()));
    animationFrame = requestAnimationFrame(trackTime);
  }

  function fail(cause: unknown) {
    cleanup();
    loading = false;
    failure = cause instanceof Error ? cause.message : "This recording could not be played.";
  }

  async function load(source = src) {
    const token = ++generation;
    cleanup();
    loading = true;
    failure = "";
    elapsed = 0;
    duration = 0;
    aspectRatio = "16 / 10";
    speed = 1;
    const controller = new AbortController();
    request = controller;
    try {
      const [response, { Replayer: Player }] = await Promise.all([
        fetch(source, { signal: controller.signal }),
        import("@rrweb/replay"),
      ]);
      if (!response.ok) throw new Error(`Recording could not be loaded (${response.status}).`);
      const artifact = await response.json();
      if (disposed || token !== generation || controller.signal.aborted) return;
      const events = Array.isArray(artifact) ? artifact : artifact?.events;
      if (!Array.isArray(events) || events.length < 2)
        throw new Error("This file has no playable rrweb events.");
      const snapshot = events.find((event: eventWithTime) => event.type === 2);
      if (!snapshot) throw new Error("This recording has no full DOM snapshot.");
      player = new Player(events as eventWithTime[], {
        root: stage,
        skipInactive: false,
        triggerFocus: false,
        UNSAFE_replayCanvas: false,
        showWarning: false,
      });
      player.iframe.title = "Recorded page (read-only session replay)";
      player.iframe.tabIndex = -1;
      player.disableInteract();
      player.on("resize", fit);
      player.on("finish", () => {
        playing = false;
        elapsed = duration;
        cancelAnimationFrame(animationFrame);
      });
      duration = player.getMetaData().totalTime;
      // rrweb only casts events strictly before a seek offset. Include the initial
      // snapshot when paused at the start, otherwise rewinding leaves a blank frame.
      snapshotOffset = Math.max(0, snapshot.timestamp - events[0].timestamp + 1);
      player.pause(snapshotOffset);
      observer = new ResizeObserver(fit);
      observer.observe(stage);
      fit();
      ready = true;
      loading = false;
    } catch (cause) {
      if (disposed || token !== generation || controller.signal.aborted) return;
      fail(cause);
    }
  }

  function toggle() {
    if (!player) return;
    try {
      if (playing) {
        player.pause();
        playing = false;
        cancelAnimationFrame(animationFrame);
        elapsed = Math.min(duration, player.getCurrentTime());
      } else {
        if (elapsed >= duration) elapsed = 0;
        player.play(elapsed);
        playing = true;
        trackTime();
      }
    } catch (cause) {
      fail(cause);
    }
  }

  function restart() {
    if (!player) return;
    try {
      cancelAnimationFrame(animationFrame);
      player.pause(snapshotOffset);
      elapsed = 0;
      playing = false;
    } catch (cause) {
      fail(cause);
    }
  }

  function seekTo(offset: number) {
    if (!player) return;
    try {
      elapsed = Math.max(0, Math.min(duration, offset));
      if (playing) player.play(elapsed);
      else player.pause(Math.max(snapshotOffset, elapsed));
    } catch (cause) {
      fail(cause);
    }
  }

  function seek(event: Event) {
    seekTo(Number((event.currentTarget as HTMLInputElement).value));
  }

  async function toggleFullscreen() {
    fullscreenFailure = "";
    try {
      if (document.fullscreenElement === container) await document.exitFullscreen();
      else await container.requestFullscreen();
    } catch {
      fullscreenFailure = "Fullscreen is unavailable in this browser.";
    }
  }

  function keyboard(event: KeyboardEvent) {
    // Native controls keep their own keyboard behavior.
    const target = event.target;
    if (
      !(target instanceof HTMLElement) ||
      !container?.contains(target) ||
      !ready ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    if (
      target.closest("input, select, textarea") ||
      (event.key === " " && target.closest("button"))
    )
      return;
    if ([" ", "ArrowLeft", "ArrowRight", "Home", "f"].includes(event.key)) event.preventDefault();
    if (event.key === " ") toggle();
    else if (event.key === "ArrowLeft") seekTo(elapsed - 5000);
    else if (event.key === "ArrowRight") seekTo(elapsed + 5000);
    else if (event.key === "Home") restart();
    else if (event.key === "f") void toggleFullscreen();
  }

  function changeSpeed(event: Event) {
    speed = Number((event.currentTarget as HTMLSelectElement).value);
    player?.setConfig({ speed });
  }

  $effect(() => {
    void load(src);
  });

  onDestroy(() => {
    disposed = true;
    ++generation;
    // Svelte also runs onDestroy during SSR; animation APIs only exist in the browser.
    if (browser) cleanup();
  });
</script>

<svelte:window onkeydown={keyboard} />

<svelte:document
  onfullscreenchange={() => (fullscreen = document.fullscreenElement === container)}
/>

<div
  role="region"
  class="replay-player"
  bind:this={container}
  aria-label="Session replay player"
  aria-describedby="replay-shortcuts"
  aria-busy={loading}
>
  <span id="replay-shortcuts" class="sr-only"
    >Space to play or pause. Arrow keys to seek five seconds. Home to restart. F for fullscreen.</span
  >
  <div class="replay-stage" bind:this={stage} style:aspect-ratio={aspectRatio}></div>
  {#if loading}
    <div class="replay-overlay" role="status">
      <span class="spinner" aria-hidden="true"></span><span>Preparing session replay…</span>
    </div>
  {:else if failure}
    <div class="replay-overlay replay-error" role="alert">
      <strong>Replay unavailable</strong>
      <p>{failure}</p>
      <button class="button button-secondary" type="button" onclick={() => void load()}
        >Try again</button
      >
    </div>
  {/if}
  <div class="replay-controls">
    <input
      class="replay-seek"
      type="range"
      min="0"
      max={Math.max(1, duration)}
      step="1"
      value={elapsed}
      style={`--progress: ${duration ? (elapsed / duration) * 100 : 0}%`}
      oninput={seek}
      disabled={!ready || duration === 0}
      aria-label="Seek replay"
      aria-valuetext={`${formatDuration(elapsed)} of ${formatDuration(duration)}`}
    />
    <button
      class="play-button"
      type="button"
      aria-label={playing ? "Pause replay" : "Play replay"}
      disabled={!ready}
      onclick={toggle}
    >
      {#if playing}<svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          ><rect x="6" y="5" width="4" height="14" rx="1" /><rect
            x="14"
            y="5"
            width="4"
            height="14"
            rx="1"
          /></svg
        >{:else}<svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"><path d="m8 5 11 7-11 7V5Z" /></svg
        >{/if}
    </button>
    <button
      class="icon-button"
      type="button"
      aria-label="Restart replay"
      disabled={!ready}
      onclick={restart}
      ><svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.5 7M3 4v7h7" /></svg
      ></button
    >
    <button
      class="icon-button skip-button"
      type="button"
      aria-label="Back 5 seconds"
      title="Back 5 seconds"
      disabled={!ready}
      onclick={() => seekTo(elapsed - 5000)}>−5<span class="sr-only"> seconds</span></button
    >
    <button
      class="icon-button skip-button"
      type="button"
      aria-label="Forward 5 seconds"
      title="Forward 5 seconds"
      disabled={!ready}
      onclick={() => seekTo(elapsed + 5000)}>+5<span class="sr-only"> seconds</span></button
    >
    <span class="playback-time"
      >{formatDuration(elapsed)} <span>/ {formatDuration(duration)}</span></span
    >
    <span class="replay-state"
      >{loading
        ? "Loading"
        : failure
          ? "Unavailable"
          : playing
            ? "Playing"
            : elapsed >= duration
              ? "Finished"
              : "Paused"}</span
    >
    <label class="playback-speed"
      ><span class="sr-only">Playback speed</span><select
        value={String(speed)}
        onchange={changeSpeed}
        disabled={!ready}
        ><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option
        ><option value="4">4×</option></select
      ></label
    >
    {#if browser && document.fullscreenEnabled}
      <button
        class="icon-button"
        type="button"
        aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
        disabled={!ready}
        onclick={() => void toggleFullscreen()}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          aria-hidden="true"
          ><path
            d={fullscreen
              ? "M8 3v5H3m13-5v5h5M3 16h5v5m13-5h-5v5"
              : "M8 3H3v5m13-5h5v5M3 16v5h5m13-5h5v-5"}
          /></svg
        >
      </button>
    {/if}
  </div>
  {#if fullscreenFailure}<p class="fullscreen-error" role="status">{fullscreenFailure}</p>{/if}
</div>
