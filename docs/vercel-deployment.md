# Deploy to your personal Vercel account

Run these commands from the **repository root**, so Vercel uploads the shared
workspace packages as well as the selected app. Every project command explicitly
sets `--scope`; use the slug of your personal Vercel workspace, not a work team.
These commands deploy to production.

## 1. Sign in and select your personal workspace

```sh
npx vercel@latest login
npx vercel@latest whoami
npx vercel@latest teams ls

export SONDA_VERCEL_SCOPE='REPLACE_WITH_PERSONAL_WORKSPACE_SLUG'
export SONDA_BACKEND_PROJECT='sonda-backend'
export SONDA_DEMO_PROJECT='sonda-demo'
```

Use the personal workspace slug shown in Vercel's account/workspace selector.
For accounts where the personal Hobby workspace appears as a team, use that
workspace's slug. Do not assume that the signed-in username is the workspace slug.

## 2. Create and configure both projects

In the Vercel dashboard, select your **personal workspace** and import this
repository twice with these settings:

| Setting                                     | Backend         | Demo         |
| ------------------------------------------- | --------------- | ------------ |
| Project name                                | `sonda-backend` | `sonda-demo` |
| Root Directory                              | `apps/backend`  | `apps/demo`  |
| Framework                                   | SvelteKit       | Vite         |
| Node.js                                     | 22.x            | 22.x         |
| Include source files outside Root Directory | Enabled         | Enabled      |

Use different project names in both the table and shell variables if these names
already belong to other projects. The checked-in app `vercel.json` files supply
the install/build settings. If importing starts an initial deployment before
configuration is complete, use the commands below to deploy again after setup.

Copy each project's assigned **production domain** from its Domains settings;
use these stable domains, not individual deployment URLs:

```sh
export SONDA_BACKEND_URL='https://sonda-backend.vercel.app'
export SONDA_DEMO_URL='https://sonda-demo.vercel.app'
```

The current deployment uses `SONDA_STORAGE_PROVIDER=mock` and requires no Blob
store. Submissions are temporary, isolated per function instance, and capped at
100 entries / 32 MiB. For a durable deployment instead, remove that variable and
in the backend project's Storage tab, create and connect a **private Vercel Blob
store** to **Production**. Confirm that it adds `BLOB_READ_WRITE_TOKEN` to the
backend environment. Keep this token server-side; do not put it in the demo or
paste it into these commands.

## 3. Configure and deploy the backend

```sh
npx vercel@latest link --yes --scope "$SONDA_VERCEL_SCOPE" --project "$SONDA_BACKEND_PROJECT"
npx vercel@latest env add ENABLE_EXPERIMENTAL_COREPACK production --scope "$SONDA_VERCEL_SCOPE" <<< '1'
npx vercel@latest env add SONDA_ALLOWED_ORIGINS production --scope "$SONDA_VERCEL_SCOPE" <<< "$SONDA_DEMO_URL"
npx vercel@latest deploy --prod --yes --scope "$SONDA_VERCEL_SCOPE"
curl --fail --show-error "$SONDA_BACKEND_URL/api/v1/health"
```

Expected health response: `{"status":"ok","service":"sonda-backend"}`.

## 4. Configure and deploy the demo

```sh
npx vercel@latest link --yes --scope "$SONDA_VERCEL_SCOPE" --project "$SONDA_DEMO_PROJECT"
npx vercel@latest env add ENABLE_EXPERIMENTAL_COREPACK production --scope "$SONDA_VERCEL_SCOPE" <<< '1'
npx vercel@latest env add VITE_SONDA_BACKEND_URL production --scope "$SONDA_VERCEL_SCOPE" <<< "$SONDA_BACKEND_URL"
npx vercel@latest deploy --prod --yes --scope "$SONDA_VERCEL_SCOPE"
```

Open `$SONDA_DEMO_URL`, submit a small capture, and follow its inbox link. Uploads
must stay below 4 MiB total on Vercel. If Deployment Protection is enabled, ensure
it permits the demo browser's API requests, including CORS preflight requests.
Personal account ownership does not make the application private: the inbox has
no application authentication.

`env add` is for initial setup. If a variable already exists, use `vercel env
update` with the same arguments instead, then redeploy.

## Subsequent deployments

Always relink explicitly before deploying; the root `.vercel/project.json` points
to whichever project was linked most recently.

```sh
npx vercel@latest link --yes --scope "$SONDA_VERCEL_SCOPE" --project "$SONDA_BACKEND_PROJECT"
npx vercel@latest deploy --prod --yes --scope "$SONDA_VERCEL_SCOPE"

npx vercel@latest link --yes --scope "$SONDA_VERCEL_SCOPE" --project "$SONDA_DEMO_PROJECT"
npx vercel@latest deploy --prod --yes --scope "$SONDA_VERCEL_SCOPE"
```
