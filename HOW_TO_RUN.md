# HIIEKO / Solar Site Management

## Requirements

- Node.js 18.17 or newer (Node.js 20 LTS recommended)
- npm 9 or newer
- A running PostgreSQL 18 instance (see [backend/.env.example](backend/.env.example) for connection string)

## Install

Open PowerShell in the project folder and run:

```powershell
npm install
```

This installs dependencies for the root project and all workspaces (`shared`, `web`, `Mobile`, `backend`).

## Configure the environment

Copy the example environment files and edit to match your setup:

```powershell
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env
Copy-Item web\.env.example web\.env.local
Copy-Item Mobile\.env.example Mobile\.env
```

The authoritative backend config lives in `backend/.env` — set `DATABASE_URL`, `JWT_SECRET`, etc.

Never commit or share `.env`, `*.env.local`, or any file containing secrets.

## Set up the database

Create a PostgreSQL 18 database, then run:

```powershell
npm run db:migrate
```

This applies all Prisma migrations. Verify with:

```powershell
npm run db:verify
```

## Start the backend (NestJS)

```powershell
npm run backend:dev
```

The API starts at http://localhost:4000.

## Start the web app (Next.js)

```powershell
npm run web:dev
```

Open http://localhost:3000.

## Run the dev stack on a tablet / phone (same Wi-Fi)

Both dev servers already listen on every interface (`Next.js` on `0.0.0.0:3000`,
NestJS on `0.0.0.0:4000`), and the web client resolves the API host at runtime,
so no extra configuration is needed:

1. Start the backend (leave it running): `npm run backend:dev`
2. Start the web app (leave it running): `npm run web:dev`
3. Find this machine's IPv4 address: `ipconfig` (e.g. `192.168.1.130`)
4. On the tablet/phone open: `http://<laptop-ip>:3000`

Why it works: the page is served by the laptop, so on the tablet `localhost` is
the *tablet*, not the laptop. `web/src/lib/api-client.ts` therefore derives the
API base URL from the hostname that served the page (`http://<laptop-ip>:4000`)
whenever `NEXT_PUBLIC_API_URL` points at loopback. Local development on the
laptop is unchanged (`http://localhost:4000`).

To pin an explicitly deployed API host instead, set it in `web/.env.local` and
restart `npm run web:dev`:

```
NEXT_PUBLIC_API_URL=http://api.example.com
```

Check from the tablet (or from this laptop with the LAN IP):

| URL | Expected |
|-----|----------|
| `http://<laptop-ip>:3000` | HIIEKO login page |
| `http://<laptop-ip>:4000/api/docs` | Swagger UI (proves the API is reachable) |

If `http://<laptop-ip>:4000/api/docs` does **not** open from the tablet, the
Windows Firewall is blocking the dev ports. Allow inbound TCP 3000 + 4000 for
Node.js on private networks (run once, in an elevated PowerShell):

```powershell
New-NetFirewallRule -DisplayName "HIIEKO dev (3000, 4000)" -Direction Inbound `
  -Action Allow -Protocol TCP -LocalPort 3000,4000 -Profile Private
```

The dev servers have no TLS and no LAN hardening — use this only on a trusted
local network, and stop them when you are done.

> The Expo app cannot derive the host this way (React Native has no `window`):
> set `EXPO_PUBLIC_API_URL=http://<laptop-ip>:4000` in `Mobile/.env` instead.

## Start the mobile app (Expo)

```powershell
npm run mobile:start
```

The mobile workspace requires its own Expo/React Native environment.

## OCR (PaddleOCR)

Receipt OCR is a server-side service. The NestJS backend calls a self-hosted PaddleOCR
instance configured via `PADDLEOCR_URL` and `PADDLEOCR_TOKEN` in `backend/.env`.
OCR results are editable and must be checked by a user before saving.

## Validation commands

```powershell
npm run typecheck     # TypeScript checks on all 4 workspaces
npm run test          # Backend Jest test suite
npm run build         # Build shared, web, and backend
```

## Other workspace commands

```powershell
npm run backend:test
npm run backend:build
```
