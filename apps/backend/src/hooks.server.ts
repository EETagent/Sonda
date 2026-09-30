import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import type { Handle } from "@sveltejs/kit";

const LOCAL_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

const isLoopback = (url: URL): boolean =>
  ["http:", "https:"].includes(url.protocol) &&
  ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

const isLocalOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    return origin === url.origin && isLoopback(url);
  } catch {
    return false;
  }
};

export const handle: Handle = async ({ event, resolve }) => {
  const { request, url } = event;
  const origin = request.headers.get("origin");
  const configured = env.SONDA_ALLOWED_ORIGINS;
  const allowedOrigins =
    configured === undefined
      ? LOCAL_ORIGINS
      : configured
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
  // Local Vite servers can choose another port when their preferred port is busy.
  // Explicit allowlists still take precedence, including on local servers.
  const local =
    configured === undefined && isLoopback(url) && origin !== null && isLocalOrigin(origin);
  const trusted =
    origin === null || origin === url.origin || allowedOrigins.includes(origin) || local;
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const api = url.pathname.startsWith("/api/v1/");

  // This is the CSRF check for the upload API as well as any future form actions.
  // Unlike SvelteKit's form-only check it also allows non-browser clients without Origin.
  if (
    (mutation || request.method === "OPTIONS") &&
    (!trusted || (!origin && request.headers.get("sec-fetch-site") === "cross-site"))
  ) {
    return json(
      {
        message:
          "This origin is not allowed to submit. Configure SONDA_ALLOWED_ORIGINS on the backend.",
      },
      { status: 403 },
    );
  }

  const response =
    api && request.method === "OPTIONS"
      ? new Response(null, { status: 204 })
      : await resolve(event);

  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "no-referrer");
  if (api) {
    response.headers.append("vary", "Origin");
    if (origin && trusted) {
      response.headers.set("access-control-allow-origin", origin);
      response.headers.set("access-control-allow-methods", "GET, HEAD, POST, DELETE, OPTIONS");
      response.headers.set("access-control-allow-headers", "Content-Type, Accept");
      response.headers.set("access-control-expose-headers", "Location");
    }
  }
  return response;
};
