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

This installs dependencies for the root project and all workspaces (`shared`, `web`, `mobile`, `backend`).

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
