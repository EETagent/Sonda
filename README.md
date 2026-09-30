# Sonda


<img width="1512" height="896" alt="image" src="https://github.com/user-attachments/assets/4bd4c908-278a-415f-a402-6190113f3508" />

<img width="1455" height="870" alt="image" src="https://github.com/user-attachments/assets/52a9f3bb-9513-4539-b56d-1893d98a773e" />

<img width="366" height="387" alt="image" src="https://github.com/user-attachments/assets/906d00d1-b0fa-4c10-989f-3be1aba04e37" />

A Lit capture widget with a SvelteKit inbox for screenshots and rrweb session recordings.

## Development

Requires Node.js 22.12 or newer and pnpm 12.

```sh
pnpm install
pnpm dev:backend
```

In a second terminal:

```sh
pnpm dev
```

The demo runs on port 5173 and the inbox on port 3001. Environment variable examples live in `apps/demo/.env.example` and `apps/backend/.env.example`.

## Code layout

- `packages/client/src/sonda-capture.ts`: widget state, capture actions, and review UI.
- `packages/client/src/screenshot-editor.ts`: annotations, pointer input, and editing history. Styles live in `screenshot-editor-styles.ts`.
- `packages/client/src/recording.ts`: bounded in-memory rrweb sessions and recorder ownership.
- `packages/client/src/replay-preview.ts`: replay playback inside the widget.
- `packages/buddy`: the launcher's avatar and animation engine.
- `apps/demo/src`: the host-app example, playground, and explicit upload integration.
- `apps/backend/src/lib/components`: Svelte upload and evidence viewers.
- `apps/backend/src/lib/server`: request parsing and filesystem storage.
- `apps/backend/src/lib/validation.ts`: submission and replay validation contracts.
- `apps/backend/src/routes/api/v1`: submission, artifact, and health endpoints.

The widget emits `sonda-accept`, `sonda-discard`, and `sonda-error` events. Accepting a capture returns a blob to the host app; the demo's upload button sends it to `POST /api/v1/submit`.

## Checks

```sh
pnpm check
pnpm exec playwright install chromium firefox webkit
pnpm test:browser
pnpm --filter @sonda/backend test:browser
```

`pnpm check` runs lint, formatting, type checks, unit tests, and production builds. Browser tests run separately. Files under `reference/` are excluded from lint and formatting; bundled editor skills under `.cursor/skills/` are excluded from formatting.

## Deploy to Vercel

The current personal demo deployment uses `SONDA_STORAGE_PROVIDER=mock`: a bounded
in-memory inbox (100 submissions / 32 MiB per function instance), with no Blob
credentials. Data is not shared between instances and disappears on cold starts
or redeployments; older entries are evicted at capacity. For durable storage,
remove this setting and connect a private Blob store as described below.

For CLI commands targeting your personal workspace, see [the deployment commands](docs/vercel-deployment.md).

Create **two projects** from this repository. Use Node.js **22.x** for both and enable
**Include source files outside of the Root Directory in the Build Step** so pnpm can
resolve workspace packages. Each app includes its own `vercel.json` with build settings.
Enable Corepack with `ENABLE_EXPERIMENTAL_COREPACK=1` on both projects to use the
repository's pinned pnpm version.

| Project | Root Directory | Framework | Environment variables                            |
| ------- | -------------- | --------- | ------------------------------------------------ |
| Backend | `apps/backend` | SvelteKit | `BLOB_READ_WRITE_TOKEN`, `SONDA_ALLOWED_ORIGINS` |
| Demo    | `apps/demo`    | Vite      | `VITE_SONDA_BACKEND_URL`                         |

1. Create the backend project. In Vercel Storage, create a **private Blob store** and
   connect it to the backend project; this provides `BLOB_READ_WRITE_TOKEN`. Use a
   separate store for Preview if preview submissions should stay out of production.
2. Set backend `SONDA_ALLOWED_ORIGINS` to the demo's exact HTTPS origin, such as
   `https://sonda-demo.vercel.app` (no trailing slash). Multiple origins are
   comma-separated. Same-origin inbox uploads are allowed automatically.
3. Deploy the backend, then set demo `VITE_SONDA_BACKEND_URL` to its HTTPS URL,
   such as `https://sonda-backend.vercel.app`, and deploy the demo. This value is
   baked into the demo build, so redeploy after changing it. Configure variables
   for each Vercel environment you use; preview demo origins need explicit allowlisting.
4. Check `https://<backend>/api/v1/health`, submit a small screenshot from the demo,
   and open the resulting inbox entry. Verify it remains available after redeploying
   the backend, and try a short replay as well.

The backend automatically uses the Vercel adapter when `VERCEL` is set and refuses
to use disk storage on Vercel without a Blob token. Local builds continue to use
adapter-node and `SONDA_DATA_DIR`; `HOST`, `PORT`, `ORIGIN`, and `BODY_SIZE_LIMIT`
are only needed for the standalone Node server, not Vercel.

Vercel Functions have a 4.5 MB request/response limit. This deployment caps upload
requests at **4 MiB total**, including multipart fields; keep captures small.
The standalone server retains its 25 MiB request limit. Raising `BODY_SIZE_LIMIT`
does not raise Vercel's platform limit. Larger captures require a direct-to-storage
upload flow, which is not implemented here.

This is a demo inbox: its pages and APIs have **no authentication**, even though
Blob objects are private. Use non-sensitive sample captures. Vercel Deployment
Protection can also block cross-origin uploads from the demo; the backend API
must be reachable by the browser. Blob listing currently scans the inbox and is
intended for demo-scale data. Failed uploads may leave unlisted orphan artifacts
in Blob storage; they can be removed from the Storage dashboard.
