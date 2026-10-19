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

## Start the whole dev stack (recommended)

`Start-HIIEKO.ps1` starts the OCR service, the NestJS backend and the Next.js web
app, waits until all three are ready, then prints the local and LAN URLs and saves
them to `%LOCALAPPDATA%\HIIEKO\dev-links.txt`:

```powershell
.\Start-HIIEKO.ps1                 # add -OpenFirewall to allow 3000/4000 on Private networks
```

Stop everything again with:

```powershell
.\Stop-HIIEKO.ps1
```

It starts the self-hosted OCR service (`ocr-service/`) from the prepared Python
venv on `127.0.0.1:8080` and injects `PADDLEOCR_URL`/`PADDLEOCR_TOKEN` into the
backend process, so document scanning works without editing `backend/.env`.

The manual steps below are the individual pieces the launcher runs.

## Start the backend (NestJS, manual)

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

1. Start the stack (leave it running): `.\Start-HIIEKO.ps1`
   (or the pieces manually: `npm run backend:dev` and `npm run web:dev`)
2. Find this machine's IPv4 address: `ipconfig` (e.g. `192.168.1.130`)
3. On the tablet/phone open: `http://<laptop-ip>:3000`

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

Receipt OCR is a server-side service. The NestJS backend calls a self-hosted
PaddleOCR instance (`ocr-service/`) via `PADDLEOCR_URL` and `PADDLEOCR_TOKEN`.
`Start-HIIEKO.ps1` starts it and wires these variables into the backend process
automatically. OCR results are editable and must be checked by a user before saving.

### Launcher (recommended)

`.\Start-HIIEKO.ps1` starts the OCR service from
`C:\Users\NaderGuesmi\venvs\hiieko-ocr313\Scripts\python.exe` in the `ocr-service`
directory with:

```
OCR_SERVICE_TOKEN=change-this-local-token
PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT=False
uvicorn app.main:app --host 127.0.0.1 --port 8080
```

and starts the backend with `PADDLEOCR_URL=http://localhost:8080` and the matching
`PADDLEOCR_TOKEN`. Readiness is reported per service; if OCR is not reachable the
script prints the tail of `%LOCALAPPDATA%\HIIEKO\ocr.log` and document scanning
stays disabled in the app. `.\Stop-HIIEKO.ps1` stops the OCR service together with
the backend and web terminals.

The OCR service requires **Python 3.9–3.13** (`paddlepaddle` has no wheel for newer
interpreters); the venv above is already prepared. Confirm it is up (no auth on
`/health`):

```powershell
curl http://localhost:8080/health
```

### Use it

Open **Cheltuieli → New**, select a receipt/invoice and press **Process document**.
The button is enabled only when `GET /api/ocr/health` reports `{ "status": "ok" }`
(authenticated; the web client sends the bearer token). Otherwise the form shows
whether the provider is not configured or the service is unreachable.

### Manual alternative

```powershell
cd ocr-service
$env:OCR_SERVICE_TOKEN="change-this-local-token"
$env:PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT="False"
C:\Users\NaderGuesmi\venvs\hiieko-ocr313\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8080
```

Then start the backend with the OCR variables in its environment (process env wins
over `backend/.env`, which must never be edited):

```powershell
$env:PADDLEOCR_URL="http://localhost:8080"; $env:PADDLEOCR_TOKEN="change-this-local-token"; npm run backend:dev
```

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
