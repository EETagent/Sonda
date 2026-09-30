# Submission webhooks for agents

This is an inactive backend integration in
`apps/backend/src/lib/server/agent-webhooks.ts`. No route, storage operation, UI,
environment variable, or background task invokes it. Existing submissions do not
send webhooks. Both the dispatcher and each destination default to disabled.

The interface targets an agent gateway that accepts this contract, rather than a
provider-specific API such as Cursor's agent launch API. Provider adapters can
translate the event into their own launch requests later.

## Contract

`SubmissionCreatedEvent` contains `schemaVersion: 1`, `type: "submission.created"`,
a stable `id` of `submission.created:<submission UUID>`, the saved submission's
`createdAt`, the complete `submission` record, and absolute `links` to the inbox
entry, API record, screenshot and replay. Missing artifact links are `null`;
binary files are not embedded. The public origin comes from trusted server
configuration, not request headers or submitted URLs.

Each enabled agent receives a JSON POST. Headers include `X-Sonda-Event`,
`X-Sonda-Event-Id`, `X-Sonda-Timestamp` (Unix seconds), and `X-Sonda-Signature`.
The signature is `sha256=<hex HMAC-SHA256(secret, timestamp + "." + raw body)>`.
Receivers should compare signatures in constant time, enforce a timestamp window
(for example five minutes), and deduplicate by event ID per agent. Secrets are
per destination and are never included in the payload. Use HTTPS in production.
Artifact links use the existing backend access policy; they are not signed URLs.

## Future server integration

```ts
const dispatcher = createAgentDispatcher({
  enabled: false,
  publicOrigin: "https://inbox.example.com",
  agents: [
    {
      id: "investigation-agent",
      enabled: false,
      url: "https://agent-gateway.example.com/webhooks/sonda",
      secret: "load-from-server-secret-storage",
    },
  ],
});
// Future worker, after persistence: await dispatcher.dispatch(savedSubmission).
```

Only trusted server configuration may supply destinations and secrets. Submission
metadata never chooses recipients. All enabled destinations receive the event;
each returns a `delivered`, `failed`, or `skipped` result. HTTP 2xx acknowledges
delivery, not completion of agent work. Failures are isolated by destination;
redirects are rejected and requests time out after 10 seconds by default
(configurable from 1 to 60000 milliseconds). Invalid shared configuration or
event serialization throws before sending; invalid individual destinations return
a configuration failure. Error results do not expose URLs, secrets or response bodies.

There is no automatic retry, delivery persistence, queue, incoming webhook route,
or agent execution callback. Before activating this, connect dispatch to a durable
worker/outbox after successful submission storage and define retry handling with
the stable event ID. Do not launch unawaited work in a serverless request.
