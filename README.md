# Xirel (local & offline)

A full-stack e-commerce app (React + Express + tRPC) for premium electronics
and outfits — running entirely on your own machine. No cloud account, no
external database, no internet connection required after install.

## What changed from the original template

This project was originally scaffolded on Manus's cloud platform and relied
on their infrastructure for things a self-hosted app can't assume:

| Original (cloud-dependent)      | Now (local/offline)                     |
|----------------------------------|------------------------------------------|
| Manus OAuth login                | Local email + password login (JWT cookie) |
| MySQL on a hosted DB server       | SQLite file in `./data/store.db`          |
| S3 file storage via Forge proxy  | Files saved to `./data/uploads`, served at `/uploads` |
| Forge "notify owner" API         | Logs to the server console                |
| `vite-plugin-manus-runtime`      | Removed                                   |

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

Before deploying, set these environment variables on whichever platform you
pick:

- `JWT_SECRET` — a long random string (Render can auto-generate this for you; see `render.yaml`)
- `ADMIN_EMAIL` — **set this to your own email before anyone else can register.**
  Only this exact address can become admin, so a stranger can't sign up first
  and grab the admin account. (If you leave it unset, the very first person to
  register becomes admin instead — fine for local use, risky once it's public.)

### Railway

1. Push this repo to GitHub, then create a new Railway project from it (Railway auto-detects the `Dockerfile`).
2. In the service settings, add a **Volume** mounted at `/data`.
3. Add environment variables: `JWT_SECRET`, `ADMIN_EMAIL`, `DATABASE_FILE=/data/store.db`, `UPLOADS_DIR=/data/uploads`.
4. Deploy. Railway gives you a public URL automatically (HTTPS included).
5. Note: Railway's free trial is credit-based and volumes aren't guaranteed to persist after the trial ends — move to the Hobby plan (~$5/mo) if you want the data to stick around.

### Render

1. Push this repo to GitHub. In Render, choose **New → Blueprint** and point it at the repo — it will pick up `render.yaml` automatically.
2. Render will prompt you to fill in `ADMIN_EMAIL` (marked `sync: false` in the blueprint) and will auto-generate `JWT_SECRET`.
3. Note: Render's **free** web services can't attach a persistent disk. `render.yaml` uses the `starter` plan (~$7/mo), which is the cheapest tier that supports one. Without a paid plan + disk, your database and uploads would be wiped on every restart.

### Either platform, manually with just Docker

```bash
docker build -t ecommerce-store .
docker run -p 3000:3000 \
  -e JWT_SECRET=your-long-random-secret \
  -e ADMIN_EMAIL=you@example.com \
  -v ecommerce-data:/data \
  ecommerce-store
```

After deploying, visit your URL, register with the email you set as
`ADMIN_EMAIL` first, and you'll land in `/admin`. Then run the seed step
against the deployed database if you want the sample products (or just add
your own through the admin panel).
