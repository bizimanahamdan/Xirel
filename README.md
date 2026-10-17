# Xirel (local & offline)

A full-stack e-commerce app (React + Express + tRPC) for premium electronics
and outfits — running entirely on your own machine. No cloud account, no
external database, no internet connection required after install.

## What changed from the original template

This project was originally scaffolded on Manus's cloud platform and relied
on their infrastructure for things a self-hosted app can't assume:

| Original (cloud-dependent)      | Now (local/offline)                                   |
| ------------------------------- | ----------------------------------------------------- |
| Manus OAuth login               | Local email + password login (JWT cookie)             |
| MySQL on a hosted DB server     | SQLite file in `./data/store.db`                      |
| S3 file storage via Forge proxy | Files saved to `./data/uploads`, served at `/uploads` |
| Forge "notify owner" API        | Logs to the server console                            |
| `vite-plugin-manus-runtime`     | Removed                                               |

Stripe support is still in the codebase (for real payment processing) but is
**disabled by default** — the store works completely without it, and enabling
it is the only thing that would require internet access.

## Requirements

- Node.js 20+
- npm (comes with Node)

No database server, Docker, or accounts of any kind are needed.

## Setup

```bash
npm install
cp .env.example .env   # optional — defaults work fine as-is
npm run seed           # creates data/store.db and adds sample products
npm run dev
```

Open http://localhost:3000. The dev server also serves the frontend (with
hot reload), so you only need this one command.

The **first account you register** through the "Create Account" tab on the
`/login` page automatically becomes the store admin, with access to
`/admin`, `/admin/products`, `/admin/orders`, `/admin/users`, and
`/admin/payment-settings`.

## Production build

```bash
npm run build
npm start
```

## Data & files

- Database: `./data/store.db` (SQLite — delete this file to reset everything)
- Uploaded product images: `./data/uploads`

Both paths are configurable via `DATABASE_FILE` and `UPLOADS_DIR` in `.env`.

## Optional: accepting real payments

Payment settings live under `/admin/payment-settings`. If you enter a Stripe
secret/publishable key pair and enable Stripe there, checkout will call out to
Stripe's API — that's the one feature that needs internet access. Leave it
disabled to keep the whole app offline.

## Tests

```bash
npm test
```

## Deploying so anyone can use it

This repo includes a `Dockerfile` that works on both Railway and Render. Either
way, you need **persistent storage** for the SQLite database and uploaded
images — that's the one thing that rules out purely serverless hosts.

Before deploying, configure these environment variables on whichever platform
you pick:

- `JWT_SECRET` — required in production; use a unique random value with at least
  32 bytes of cryptographic strength. Render can generate this automatically.
- `ADMIN_EMAIL` — the exact operator email allowed for safe first-admin bootstrap.
  Configure it before registering that address. If no administrator exists, only
  this configured account can be promoted; with `ADMIN_EMAIL` unset, every public
  registration remains an ordinary user.
- `SESSION_TTL_DAYS` — optional whole number from 1 to 30 (default 7).
- `TRUST_PROXY_HOPS` — number of trusted reverse proxies (Render uses 1).
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` — use the same shared database for
  every instance if the app runs with multiple instances; rate-limit counters are
  stored there rather than only in process memory.

See [`SECURITY.md`](SECURITY.md) for the controlled JWT rotation and administrator
bootstrap procedures.

### Railway

1. Push this repo to GitHub, then create a new Railway project from it (Railway auto-detects the `Dockerfile`).
2. In the service settings, add a **Volume** mounted at `/data`.
3. Add environment variables: `JWT_SECRET`, `ADMIN_EMAIL`, `DATABASE_FILE=/data/store.db`, `UPLOADS_DIR=/data/uploads`.
4. Deploy. Railway gives you a public URL automatically (HTTPS included).
5. Note: Railway's free trial is credit-based and volumes aren't guaranteed to persist after the trial ends — move to the Hobby plan (~$5/mo) if you want the data to stick around.

### Render

1. Push this repo to GitHub. In Render, choose **New → Blueprint** and point it at the repo — it will pick up `render.yaml` automatically.
2. Render will prompt you to fill in `ADMIN_EMAIL` (marked `sync: false` in the blueprint) and will auto-generate `JWT_SECRET`.
3. Note: the checked-in `render.yaml` uses Render's **free** plan, which has no persistent disk. Configure the prompted `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` values before relying on production data; otherwise the local SQLite fallback may be lost on restart. Alternatively, switch to a paid plan and configure persistent storage.

### Either platform, manually with just Docker

```bash
# Generate a strong secret once and persist it in your deployment secret manager:
export JWT_SECRET="$(openssl rand -base64 48)"
docker build -t ecommerce-store .
docker run -p 3000:3000 \
  -e JWT_SECRET="${JWT_SECRET:?Set JWT_SECRET first}" \
  -e ADMIN_EMAIL=you@example.com \
  -v ecommerce-data:/data \
  ecommerce-store
```

Do not generate a new `JWT_SECRET` for each restart; changing it invalidates all active sessions. See [`SECURITY.md`](SECURITY.md) for the controlled rotation procedure.

On a fresh database, set `ADMIN_EMAIL` before deployment, then register that
exact address. The server atomically promotes it only when no administrator
already exists. On an existing database, current administrators are preserved;
if none exist, configure `ADMIN_EMAIL` for an operator-controlled account and
restart before registering or logging in to that account. A missing
`ADMIN_EMAIL` never grants admin to a public registrant.

Then run the seed step against the deployed database if you want the sample
products (or add your own through the admin panel).
