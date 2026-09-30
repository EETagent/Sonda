import { EventType } from "@rrweb/types";
import type { ReplayArtifact } from "./types.js";
import replayCss from "@rrweb/replay/dist/style.css?inline";
export interface PlaybackState {
  currentTime: number;
  duration: number;
  playing: boolean;
}
export interface ReplayPreview {
  play(): void;
  pause(): void;
  seek(time: number): void;
  restart(): void;
  setSpeed(speed: number): void;
  destroy(): void;
}
export const createReplayPreview = async (
  container: HTMLElement,
  artifact: ReplayArtifact,
  onProgress: (state: PlaybackState) => void,
): Promise<ReplayPreview> => {
  const { Replayer } = await import("@rrweb/replay");
  if (!container.isConnected) throw new Error("Replay preview was closed.");
  const snapshot = artifact.events.find((event) => event.type === EventType.FullSnapshot);
  if (!snapshot) throw new Error("This recording has no full DOM snapshot.");
  const style = document.createElement("style");
  style.textContent = replayCss;
  const root = document.createElement("div");
  root.style.cssText = "position:absolute;inset:0;overflow:hidden";
  container.append(style, root);
  let player: InstanceType<typeof Replayer>;
  try {
    player = new Replayer(artifact.events, {
      root,
      skipInactive: false,
      triggerFocus: false,
      UNSAFE_replayCanvas: false,
      showWarning: false,
    });
  } catch (error) {
    root.remove();
    style.remove();
    throw error;
  }
  let playing = false;
  let destroyed = false;
  const duration = player.getMetaData().totalTime;
  player.iframe.tabIndex = -1;
  player.iframe.setAttribute("aria-hidden", "true");
  player.disableInteract();
  const fit = () => {
    const width = player.iframe.width
      ? Number(player.iframe.width)
      : player.iframe.getBoundingClientRect().width;
    const height = player.iframe.height
      ? Number(player.iframe.height)
      : player.iframe.getBoundingClientRect().height;
    if (!width || !height) return;
    const scale = Math.min(container.clientWidth / width, container.clientHeight / height, 1);
    player.wrapper.style.transformOrigin = "top left";
    player.wrapper.style.transform = `scale(${scale})`;
    player.wrapper.style.position = "absolute";
    player.wrapper.style.left = `${(container.clientWidth - width * scale) / 2}px`;
    player.wrapper.style.top = `${(container.clientHeight - height * scale) / 2}px`;
  };
  const update = () => {
    if (!destroyed)
      onProgress({
        currentTime: Math.max(0, Math.min(duration, player.getCurrentTime())),
        duration,
        playing,
      });
  };
  const finish = () => {
    playing = false;
    update();
  };
  player.on("resize", fit);
  player.on("finish", finish);
  const observer = new ResizeObserver(fit);
  observer.observe(container);
  const timer = setInterval(update, 100);
  // rrweb casts events strictly before the seek offset. Include the snapshot
  // so a paused preview at the start shows the page rather than a blank iframe.
  const snapshotOffset = Math.max(0, snapshot.timestamp - artifact.events[0].timestamp + 1);
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    clearInterval(timer);
    observer.disconnect();
    player.off("resize", fit);
    player.off("finish", finish);
    player.destroy();
    root.remove();
    style.remove();
  };
  try {
    player.pause(snapshotOffset);
    fit();
    update();
  } catch (error) {
    destroy();
    throw error;
  }
  return {
    play() {
      if (destroyed) return;
      const current = player.getCurrentTime();
      playing = true;
      player.play(current >= duration ? 0 : current);
      update();
    },
    pause() {
      if (destroyed) return;
      player.pause();
      playing = false;
      update();
    },
    seek(time) {
      if (destroyed) return;
      const offset = Math.max(0, Math.min(duration, time));
      if (playing) player.play(offset);
      else player.pause(Math.max(snapshotOffset, offset));
      update();
    },
    restart() {
      if (destroyed) return;
      playing = true;
      player.play(0);
      update();
    },
    setSpeed(speed) {
      if (!destroyed && Number.isFinite(speed) && speed > 0) player.setConfig({ speed });
    },
    destroy,
  };
};
