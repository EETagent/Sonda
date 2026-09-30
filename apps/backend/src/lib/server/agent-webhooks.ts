import { createHmac } from "node:crypto";
import { artifactUrl, type Submission } from "../submissions.js";

/** Provider-neutral contract for agent gateways accepting submitted entries. */
export interface SubmissionCreatedEvent {
  schemaVersion: 1;
  id: string;
  type: "submission.created";
  createdAt: string;
  submission: Submission;
  links: {
    submission: string;
    api: string;
    screenshot: string | null;
    replay: string | null;
  };
}

/** Trusted server configuration only; never populate endpoints from submission metadata. */
export interface AgentWebhook {
  id: string;
  url: string;
  secret: string;
  enabled?: boolean;
}

export type AgentDeliveryResult =
  | { agentId: string; status: "skipped" }
  | { agentId: string; status: "delivered"; httpStatus: number }
  | {
      agentId: string;
      status: "failed";
      reason: "configuration" | "http" | "timeout" | "network";
      httpStatus?: number;
    };

export interface AgentDispatcherOptions {
  enabled?: boolean;
  publicOrigin: string;
  agents: readonly AgentWebhook[];
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

function httpUrl(value: string): URL {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new Error("Expected an HTTP(S) URL without credentials or a fragment.");
  }
  return url;
}

export function createSubmissionCreatedEvent(
  submission: Submission,
  publicOrigin: string,
): SubmissionCreatedEvent {
  const origin = httpUrl(publicOrigin);
  if (origin.pathname !== "/" || origin.search) throw new Error("Expected a public origin.");
  const absolute = (path: string) => new URL(path, origin).href;
  const id = encodeURIComponent(submission.id);
  return {
    schemaVersion: 1,
    // Stable across delivery attempts so receivers can deduplicate per agent.
    id: `submission.created:${submission.id}`,
    type: "submission.created",
    createdAt: submission.createdAt,
    submission,
    links: {
      submission: absolute(`/submissions/${id}`),
      api: absolute(`/api/v1/submissions/${id}`),
      screenshot: submission.screenshot ? absolute(artifactUrl(submission.id, "screenshot")) : null,
      replay: submission.replay ? absolute(artifactUrl(submission.id, "replay")) : null,
    },
  };
}

/** Dormant: no routes or UI call this. Both dispatcher and agent must explicitly opt in. */
export function createAgentDispatcher(options: AgentDispatcherOptions) {
  const enabled = options.enabled === true;
  const agents = options.agents.map((agent) => ({ ...agent }));
  const timeoutMs = options.timeoutMs ?? 10_000;
  const publicOrigin = options.publicOrigin;
  const send = options.fetch ?? globalThis.fetch;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new Error("Agent webhook timeout must be between 1 and 60000 milliseconds.");
  }
  if (new Set(agents.map((agent) => agent.id)).size !== agents.length) {
    throw new Error("Agent webhook IDs must be unique.");
  }

  return {
    async dispatch(submission: Submission): Promise<AgentDeliveryResult[]> {
      if (!enabled || !agents.some((agent) => agent.enabled === true)) {
        return agents.map(({ id }) => ({ agentId: id, status: "skipped" }));
      }
      const event = createSubmissionCreatedEvent(submission, publicOrigin);
      const body = JSON.stringify(event);
      return Promise.all(
        agents.map(async (agent): Promise<AgentDeliveryResult> => {
          if (agent.enabled !== true) return { agentId: agent.id, status: "skipped" };
          let endpoint: URL;
          try {
            endpoint = httpUrl(agent.url);
            if (!agent.id.trim() || !agent.secret.trim()) throw new Error("Missing configuration.");
          } catch {
            return { agentId: agent.id, status: "failed", reason: "configuration" };
          }
          const signal = AbortSignal.timeout(timeoutMs);
          const timestamp = String(Math.floor(Date.now() / 1000));
          const signature = createHmac("sha256", agent.secret)
            .update(`${timestamp}.${body}`)
            .digest("hex");
          try {
            const response = await send(endpoint.href, {
              method: "POST",
              redirect: "error",
              signal,
              headers: {
                "content-type": "application/json",
                "x-sonda-event": event.type,
                "x-sonda-event-id": event.id,
                "x-sonda-timestamp": timestamp,
                "x-sonda-signature": `sha256=${signature}`,
              },
              body,
            });
            // Agent responses are acknowledgements; do not buffer arbitrary response bodies.
            await response.body?.cancel();
            return response.ok
              ? { agentId: agent.id, status: "delivered", httpStatus: response.status }
              : {
                  agentId: agent.id,
                  status: "failed",
                  reason: "http",
                  httpStatus: response.status,
                };
          } catch {
            return {
              agentId: agent.id,
              status: "failed",
              reason: signal.aborted ? "timeout" : "network",
            };
          }
        }),
      );
    },
  };
}
