# Base44 Dev Environment

## Project Overview
Nubly App — a POS and inventory system for a "bodegón" (local store). Single-origin app: Express server (`server.ts`) serves both the REST API and the Vite-powered React SPA (middleware mode) on port 3000.

## Tech Stack
- **Runtime:** Node.js 22 (via `node:22` Docker image)
- **Package manager:** Bun (`bun.lock` is the canonical lockfile — `package-lock.json` is stale and out of sync, `npm ci` fails)
- **Frontend:** React 19 + Vite 8 + Tailwind CSS 4
- **Backend:** Express + Prisma 6 (SQLite, WAL mode)
- **Database:** SQLite at `prisma/dev.db` (committed; self-heals via `prisma db push` + seed if corrupted)

## Startup
```
docker compose -f docker-compose.base44.yml up -d
```
The compose service installs deps with `bun install --frozen-lockfile`, generates the Prisma client, then runs `tsx server.ts`.

## Known Issues
- **`npm ci` fails** — the `package-lock.json` is missing many transitive deps and has peer-dep conflicts (Vite 8 wants esbuild ≥0.27, project pins esbuild ^0.25). Use `bun install` instead.
- **Vite HMR WebSocket** doesn't connect in Express middleware mode (no WebSocket upgrade handler). Non-critical — the app renders fine; use `reload_preview` to see edits.
- **GEMINI_API_KEY** is listed in `.env.example` but not imported anywhere in the codebase. Not required to boot.

## Verification
- Health: `curl http://localhost:3000/api/health` → `{"status":"ok",...}`
- Frontend: `curl http://localhost:3000/` → Vite-served React SPA (login page)
- Container health: `docker compose -f docker-compose.base44.yml ps` → `healthy`
