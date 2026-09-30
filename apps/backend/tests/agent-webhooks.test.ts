import { createHmac } from "node:crypto";
import { expect, it, vi } from "vitest";
import type { Submission } from "../src/lib/submissions";
import {
  createAgentDispatcher,
  createSubmissionCreatedEvent,
} from "../src/lib/server/agent-webhooks";

const submission: Submission = {
  id: "8c116c9a-2b32-4ac1-a5fb-a5065b5f9c57",
  title: "Checkout fails",
  description: "Clicking pay does nothing.",
  createdAt: "2026-09-30T12:00:00.000Z",
  url: "https://shop.example/checkout",
  screenshot: { filename: "screenshot.png", bytes: 100, width: 10, height: 10 },
  replay: null,
  metadata: { agentUrl: "https://untrusted.example" },
};
const agent = { id: "agent-one", url: "https://agent.example/webhook", secret: "test-secret" };
const publicOrigin = "https://inbox.example";

it("creates stable events with absolute evidence links and no missing artifact links", () => {
  const event = createSubmissionCreatedEvent(submission, publicOrigin);
  expect(event).toMatchObject({
    schemaVersion: 1,
    type: "submission.created",
    id: `submission.created:${submission.id}`,
    createdAt: submission.createdAt,
    submission,
    links: {
      submission: `${publicOrigin}/submissions/${submission.id}`,
      api: `${publicOrigin}/api/v1/submissions/${submission.id}`,
      screenshot: `${publicOrigin}/api/v1/submissions/${submission.id}/screenshot`,
      replay: null,
    },
  });
  expect(createSubmissionCreatedEvent(submission, publicOrigin).id).toBe(event.id);
});

it.each([
  { enabled: undefined, agentEnabled: true },
  { enabled: false, agentEnabled: true },
  { enabled: true, agentEnabled: undefined },
  { enabled: true, agentEnabled: false },
])("never sends without both opt-ins: %j", async ({ enabled, agentEnabled }) => {
  const fetch = vi.fn();
  const dispatcher = createAgentDispatcher({
    enabled,
    publicOrigin,
    agents: [{ ...agent, enabled: agentEnabled }],
    fetch,
  });
  expect(await dispatcher.dispatch(submission)).toEqual([{ agentId: agent.id, status: "skipped" }]);
  expect(fetch).not.toHaveBeenCalled();
});

it("sends signed JSON only to configured agents with redirect protection and a deadline", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(new Response(null, { status: 202 }));
  const dispatcher = createAgentDispatcher({
    enabled: true,
    publicOrigin,
    agents: [{ ...agent, enabled: true }],
    fetch,
  });
  expect(await dispatcher.dispatch(submission)).toEqual([
    { agentId: agent.id, status: "delivered", httpStatus: 202 },
  ]);
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, request] = fetch.mock.calls[0];
  expect(url).toBe(agent.url);
  expect(request).toMatchObject({
    method: "POST",
    redirect: "error",
    signal: expect.any(AbortSignal),
  });
  const headers = new Headers(request!.headers);
  const body = request!.body as string;
  expect(JSON.parse(body)).toEqual(createSubmissionCreatedEvent(submission, publicOrigin));
  expect(headers.get("x-sonda-signature")).toBe(
    `sha256=${createHmac("sha256", agent.secret)
      .update(`${headers.get("x-sonda-timestamp")}.${body}`)
      .digest("hex")}`,
  );
  expect(headers.get("x-sonda-event-id")).toBe(`submission.created:${submission.id}`);
  expect(body).not.toContain(agent.secret);
});

it("isolates configuration, HTTP and network failures without retrying or leaking errors", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(new Response("secret response", { status: 503 }))
    .mockRejectedValueOnce(new Error("secret network error"))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const agents = [
    { ...agent, id: "invalid", url: "file:///etc/passwd" },
    { ...agent, id: "unsigned", secret: "" },
    { ...agent, id: "http" },
    { ...agent, id: "network" },
    { ...agent, id: "healthy" },
  ].map((entry) => ({ ...entry, enabled: true }));
  const results = await createAgentDispatcher({
    enabled: true,
    publicOrigin,
    agents,
    fetch,
  }).dispatch(submission);
  expect(results).toEqual([
    { agentId: "invalid", status: "failed", reason: "configuration" },
    { agentId: "unsigned", status: "failed", reason: "configuration" },
    { agentId: "http", status: "failed", reason: "http", httpStatus: 503 },
    { agentId: "network", status: "failed", reason: "network" },
    { agentId: "healthy", status: "delivered", httpStatus: 204 },
  ]);
  expect(fetch).toHaveBeenCalledTimes(3);
});

it("aborts a stalled delivery at its deadline", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(
    (_url, request) =>
      new Promise((_resolve, reject) => {
        request!.signal!.addEventListener("abort", () => reject(request!.signal!.reason), {
          once: true,
        });
      }),
  );
  const dispatcher = createAgentDispatcher({
    enabled: true,
    publicOrigin,
    agents: [{ ...agent, enabled: true }],
    timeoutMs: 10,
    fetch,
  });
  expect(await dispatcher.dispatch(submission)).toEqual([
    { agentId: agent.id, status: "failed", reason: "timeout" },
  ]);
});

it("rejects ambiguous IDs, invalid timeouts and untrusted public origins", () => {
  expect(() => createAgentDispatcher({ publicOrigin, agents: [agent, agent] })).toThrow("unique");
  for (const timeoutMs of [0, -1, 1.5, 60_001, NaN]) {
    expect(() => createAgentDispatcher({ publicOrigin, agents: [], timeoutMs })).toThrow("timeout");
  }
  for (const origin of [
    "file:///tmp",
    "https://user:pass@example.com",
    "https://example.com/path",
    "https://example.com?key=value",
  ]) {
    expect(() => createSubmissionCreatedEvent(submission, origin)).toThrow();
  }
});
