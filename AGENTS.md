# AGENTS.md — Nubly App (Bodegón POS)

## Overview
React + Express single-origin POS system. The `tsx server.ts` command starts an Express server on port 3000 that serves both REST API routes (`/api/v1/*`) and Vite middleware (SPA mode) for the React frontend.

## Stack
- **Frontend**: React 19 + Vite 8 + Tailwind CSS 4
- **Backend**: Express + TypeScript (run via `tsx`)
- **Database**: SQLite via Prisma (`prisma/dev.db` — committed with seed data)
- **Package manager**: npm (package-lock.json) or bun (bun.lock) — both present

## Running
```
npm ci
npx prisma generate
npx tsx server.ts
```
Server listens on `0.0.0.0:3000`. Health check: `GET /api/health`.

## Database
- SQLite file at `prisma/dev.db` (already seeded with 15 sample products + admin user)
- Prisma schema at `prisma/schema.prisma`
- WAL mode enabled at startup via `initializeDatabasePragmas()`
- If schema is corrupted, `database.ts` auto-recovers by running `prisma db push` + `prisma/seed.ts`
- To re-seed: `npx tsx prisma/seed.ts`

## Default Login
- Username: `admin`
- Password: `1234.`

## Environment Variables
- `GEMINI_API_KEY` — listed in `.env.example` but NOT referenced in code; optional
- `APP_URL` — defaults to `http://localhost:3000`; not used in practice
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — have hardcoded fallbacks in `auth.controller.ts`
- `NODE_ENV` — set to `development` for dev mode (enables Vite middleware)
- `DISABLE_HMR` — set to `true` to disable Vite HMR and file watching

## External Integrations (all optional, have fallbacks)
- **BCV Service** (`server/services/bcv.service.ts`): fetches Venezuelan exchange rates from external URLs; falls back to default rate (849.56)
- **Cloud Sync** (`server/services/cloud-sync.service.ts`): uses `@base44/sdk`; only activates if `cloudSyncEnabled` is set in DB SystemConfig
- **Cron Service**: 60-second inventory stock evaluation; only runs if alerts module is active

## Architecture Notes
- Clean architecture: controllers → services → repositories → Prisma
- In-memory product cache warmed on startup for sub-millisecond barcode lookups
- Mutex-based concurrency control for sales (prevents overselling)
- Modular system config: modules can be enabled/disabled at runtime via `/api/v1/system/modules`

## Docker Compose (Base44)
- `docker-compose.base44.yml` — single `app` service using `node:22-slim`
- Source bind-mounted at `/app`; deps installed on startup via `npm ci`
- `CHOKIDAR_USEPOLLING=true` for Vite file watching on bind mounts
