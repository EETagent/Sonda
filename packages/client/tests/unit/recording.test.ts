import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { eventWithTime } from "@rrweb/types";
import { RecordingSession, sanitizeEvent } from "../../src/recording";

const recorder = vi.hoisted(() => ({
  emit: undefined as ((event: eventWithTime) => void) | undefined,
  stop: vi.fn(),
  record: vi.fn(),
  addCustomEvent: vi.fn(),
}));
vi.mock("@rrweb/record", () => ({
  record: Object.assign(recorder.record, { addCustomEvent: recorder.addCustomEvent }),
}));

const events = [
  {
    type: 4,
    timestamp: 1000,
    data: { href: "https://example.com/?secret=1#token", width: 800, height: 600 },
  },
  {
    type: 2,
    timestamp: 1001,
    data: { node: { type: 0, id: 1, childNodes: [] }, initialOffset: { top: 0, left: 0 } },
  },
] as eventWithTime[];
let sessions: RecordingSession[];
const createSession = (options = {}, callbacks = {}) => {
  const session = new RecordingSession(options, callbacks);
  sessions.push(session);
  return session;
};

beforeEach(() => {
  sessions = [];
  vi.useFakeTimers();
  vi.clearAllMocks();
  recorder.record.mockImplementation(({ emit }) => {
    recorder.emit = emit;
    events.forEach(emit);
    return recorder.stop;
  });
  recorder.addCustomEvent.mockImplementation((tag, payload) => {
    recorder.emit?.({ type: 5, timestamp: Date.now(), data: { tag, payload } });
  });
});
afterEach(() => {
  sessions.forEach((session) => session.discard());
  vi.useRealTimers();
});

describe("recording lifecycle", () => {
  it("stops once when the final marker does not fit the byte limit", async () => {
    const onStop = vi.fn();
    const session = createSession({ maxBytes: 2048 }, { onStop });
    await session.start();
    recorder.emit?.({
      type: 5,
      timestamp: 1002,
      data: { tag: "padding", payload: "x".repeat(600) },
    });
    recorder.addCustomEvent.mockImplementation(() => {
      recorder.emit?.({
        type: 5,
        timestamp: 1003,
        data: { tag: "sonda:end", payload: "x".repeat(500) },
      });
    });
    expect(() => session.stop()).not.toThrow();
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onStop.mock.calls[0][0].metadata.stopReason).toBe("manual");
    expect(onStop.mock.calls[0][0].events).toHaveLength(3);
    expect(session.active).toBe(false);
    await createSession().start();
  });

  it("discards a session while its recorder is loading", async () => {
    const session = createSession();
    const starting = session.start();
    session.discard();
    await starting;
    expect(recorder.record).not.toHaveBeenCalled();
    await createSession().start();
  });

  it("reports snapshots that exceed the limit and releases the recorder", async () => {
    recorder.record.mockImplementation(({ emit }) => {
      emit(events[0]);
      emit({
        ...events[1],
        data: {
          node: { type: 0, id: 1, childNodes: [] },
          initialOffset: { top: 0, left: 0 },
          padding: "x".repeat(2048),
        },
      });
      return recorder.stop;
    });
    const onError = vi.fn();
    await createSession({ maxBytes: 2048 }, { onError }).start();
    expect(onError).toHaveBeenCalledOnce();
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retains idle time when the duration limit is reached", async () => {
    vi.setSystemTime(1000);
    const onStop = vi.fn();
    await createSession({ maxDurationMs: 100 }, { onStop }).start();
    vi.advanceTimersByTime(100);
    expect(onStop.mock.calls[0][0].metadata).toMatchObject({
      durationMs: 100,
      stopReason: "duration-limit",
    });
    expect(recorder.stop).toHaveBeenCalledOnce();
  });

  it.each(["tail marker", "stop handle"])(
    "releases the recorder when the %s throws during stop",
    async (failure) => {
      const onStop = vi.fn();
      const onError = vi.fn();
      const session = createSession({}, { onStop, onError });
      await session.start();
      const cause = new Error("Recorder teardown failed");
      const operation = failure === "tail marker" ? recorder.addCustomEvent : recorder.stop;
      operation.mockImplementationOnce(() => {
        throw cause;
      });

      expect(() => session.stop()).not.toThrow();
      expect(session.active).toBe(false);
      expect(recorder.stop).toHaveBeenCalledOnce();
      expect(onStop).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledExactlyOnceWith(cause);
      expect(vi.getTimerCount()).toBe(0);
      await createSession().start();
    },
  );

  it("releases ownership when discarding a recorder whose stop handle throws", async () => {
    const onError = vi.fn();
    const session = createSession({}, { onError });
    await session.start();
    const cause = new Error("Recorder teardown failed");
    recorder.stop.mockImplementationOnce(() => {
      throw cause;
    });

    expect(() => session.discard()).not.toThrow();
    expect(session.active).toBe(false);
    expect(onError).toHaveBeenCalledExactlyOnceWith(cause);
    expect(vi.getTimerCount()).toBe(0);
    await createSession().start();
  });
});

it("strips URL query and fragment without mutating the original event", () => {
  const result = sanitizeEvent(events[0]);
  expect(result.data).toMatchObject({ href: "https://example.com/" });
  expect(events[0].data).toMatchObject({ href: "https://example.com/?secret=1#token" });
});

it("removes credentials from replay viewport URLs", () => {
  const event = {
    type: 4,
    timestamp: 1000,
    data: { href: "https://user:secret@example.com/path?token=1#private", width: 800, height: 600 },
  } as eventWithTime;
  expect(sanitizeEvent(event).data).toMatchObject({ href: "https://example.com/path" });
  expect(event.data).toMatchObject({
    href: "https://user:secret@example.com/path?token=1#private",
  });
});

it("keeps recorder ownership until the active session is discarded", async () => {
  const active = createSession();
  const other = createSession();
  await active.start();
  await expect(other.start()).rejects.toThrow("Another Sonda recording is already active.");
  expect(recorder.record).toHaveBeenCalledTimes(1);
  active.discard();
  await other.start();
  expect(other.active).toBe(true);
  expect(recorder.record).toHaveBeenCalledTimes(2);
});

it("ignores late events from a discarded recording after the session restarts", async () => {
  const onStop = vi.fn();
  const session = createSession({}, { onStop });
  await session.start();
  const oldEmit = recorder.emit;
  session.discard();
  await session.start();
  oldEmit?.({ type: 5, timestamp: 1002, data: { tag: "stale", payload: {} } });
  session.stop();
  expect(onStop).toHaveBeenCalledOnce();
  expect(onStop.mock.calls[0][0].events).toHaveLength(3);
  expect(onStop.mock.calls[0][0].events.map((event: eventWithTime) => event.type)).toEqual([
    4, 2, 5,
  ]);
});
