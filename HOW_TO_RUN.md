# HIIEKO / Solar Site Management

## Requirements

- Node.js 18.17 or newer (Node.js 20 LTS recommended)
- npm 9 or newer
- A Supabase project for authentication and application data

## Install

Open PowerShell in the project folder and run:

```powershell
npm install
```

This installs dependencies for the root project and all workspaces (`shared`, `web`, and `mobile`).

## Configure the web app

Copy the example environment file:

```powershell
Copy-Item web\.env.example web\.env.local
```

Edit `web\.env.local` and add the public Supabase values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Never commit or share `web\.env.local`.

## Configure the database

Open the Supabase SQL Editor and run:

```text
supabase/full_setup.sql
```

This creates the tables, policies, storage bucket, and authentication trigger used by the app.

## Start the web app

```powershell
npm run web:dev
```

Open:

```text
http://localhost:3000
```

The project does not have a root `npm run dev` command. Use `npm run web:dev`.

## OCR

Receipt OCR uses the authenticated Supabase Edge Function, which proxies to a
private self-hosted PaddleOCR service:

```text
supabase/functions/ocr-extract
```

Deploy it after linking the project:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy ocr-extract --project-ref YOUR_PROJECT_REF
```

Configure the PaddleOCR URL and shared service token instead:

```powershell
npx supabase secrets set PADDLEOCR_URL=https://your-private-ocr-host --project-ref YOUR_PROJECT_REF
npx supabase secrets set PADDLEOCR_TOKEN=your-long-random-token --project-ref YOUR_PROJECT_REF
```

Do not put OCR service tokens in `web/.env.local` or any `NEXT_PUBLIC_` variable.
OCR results are editable and must be checked by a user before saving.

## Validation commands

```powershell
npm run typecheck
npm run build
```

## Other workspace commands

```powershell
npm run mobile:start
```

The mobile workspace requires its own Expo/React Native environment.
