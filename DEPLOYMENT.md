# CASH BACK deployment: Render API + Vercel web

The repository is a pnpm workspace. Keep the Vercel project root at the repository root so workspace packages resolve correctly.

## Render API

The included `render.yaml` creates the `cashback-api` Node web service.

- Build: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build`
- Start: `pnpm --filter @workspace/api-server run start`
- Health check: `/api/cashback/health`

The blueprint attaches a 1 GB persistent disk for private images. Render persistent disks require an eligible paid service plan and keep the service to one instance; they do not support horizontal scaling. Increase `sizeGB` before creating the service if 1 GB is not enough.

Set these service environment variables in Render:

- `NODE_ENV=production`
- `APP_STORAGE_DRIVER=render-disk`
- `APP_STORAGE_DIR=/var/data/cashback-media`
- `NEON_DATABASE_URL` — the production Neon connection string; never use `NEON_DEV_DATABASE_URL` on Render.
- `CASHBACK_ADMIN_BOOTSTRAP_TOKEN` — a random secret of at least 32 bytes, entered through Render's secret field. It is only read in production and is required for first-administrator setup.

Render supplies `PORT`; do not hardcode it. Production relational synchronization stays disabled unless explicitly enabled after the production schema has been applied and verified.

## Vercel frontend

Keep the Vercel project root at the repository root. The included `vercel.json` builds the static Vite app and proxies `/api/*` through Vercel to Render. This keeps browser API calls same-origin, including the session cookie.

- Install: `pnpm install --frozen-lockfile`
- Build: `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/cashback-app run build`
- Output directory: `artifacts/cashback-app/dist/public`

After Render creates the service, check its actual hostname. If it is not `cashback-api.onrender.com`, update the `/api/:path*` rewrite destination in `vercel.json` to the actual Render URL, then redeploy Vercel.

## Local commands

Run the API against the development Neon database:

```sh
PORT=8080 pnpm --filter @workspace/api-server run dev
```

Run the frontend in a second terminal:

```sh
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/cashback-app run dev
```

Build the services separately:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run build
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/cashback-app run build
```

## Image storage

Replit continues to use its private object-storage sidecar in the development workspace. Render uses the mounted persistent disk instead. The Render disk is private to the API service; do not expose its files through Vercel or set `PRIVATE_OBJECT_DIR` or `SA_KEY` expecting the Replit sidecar to exist.

Use a disk backup policy before storing production receipts. Because the disk is attached to one Render instance, do not add more API instances without migrating this adapter to shared object storage first.
