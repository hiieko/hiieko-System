# Configuration

> **⚠️ HISTORICAL / SUPERSEDED — Last Updated: 2026-09-18**
>
> This document describes the **Supabase-era** configuration and setup. As of 2026-09-23, Supabase has been **fully removed from the runtime** and replaced by NestJS + Prisma + PostgreSQL 18.
>
> **The current architecture has NO Supabase dependencies.** See `CURRENT_STATUS.md` for the authoritative architecture diagram and `HOW_TO_RUN.md` for current setup instructions.
>
> This file is retained for historical reference only. Do not use these instructions for current development.

Last Updated: 2026-09-18 (⚠️ SUPERSEDED — see CURRENT_STATUS.md)

Never store actual secrets in this document. Values below are placeholders or values that are already public (anon/publishable keys).

## Environment Variables

### Web (`web/.env.local`)
| Variable | Required | Environment | Purpose | Example |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Dev/Prod | Supabase project URL | `https://YOUR_PROJECT_REF.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Dev/Prod | Public (anon/publishable) client key | (see `web/.env.example`) |

### Mobile (`Mobile/.env`)
| Variable | Required | Environment | Purpose | Example |
|---|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Dev/Prod | Supabase project URL | `https://YOUR_PROJECT_REF.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Dev/Prod | Public (anon) client key | (see `Mobile/.env.example`) |
> The mobile OCR section of `Mobile/.env.example` must be updated to PaddleOCR (ISSUE-003); the OCR secrets belong to the Edge Function, not the app.

### OCR service (`ocr-service/.env` — local run)
| Variable | Required | Environment | Purpose | Example |
|---|---|---|---|---|
| `OCR_SERVICE_TOKEN` | Yes | Prod | Bearer token the Edge Function must send | `<long-random-token>` |
| `HOST` / `PORT` | No | All | Bind address | `0.0.0.0` / `8000` |

### Supabase Edge Function secrets (`supabase functions secrets set ...`)
| Variable | Required | Environment | Purpose | Example |
|---|---|---|---|---|
| `PADDLEOCR_URL` | Yes | Prod | Private OCR service base URL | `http://10.x.x.x:8000` |
| `PADDLEOCR_TOKEN` | Yes | Prod | Must match `OCR_SERVICE_TOKEN` | `<long-random-token>` |

# Configuration Files
| File | Purpose |
|---|---|
| `.env.example` (root) | Web example (contains publishable keys for a beta project) |
| `web/.env.example` | Web variables (placeholders only) |
| `Mobile/.env.example` | Mobile variables (needs PaddleOCR fix — ISSUE-003) |
| `supabase/full_setup.sql` | Complete schema + RLS + storage (run once at setup) |
| `supabase/migrations/*.sql` | Authoritative, independently versioned migrations |

# Local Setup
1. Copy the example configuration (`web/.env.example` → `web/.env.local`, `Mobile/.env.example` → `Mobile/.env`).
2. Set required values (URL + anon key).
3. Install dependencies (`npm install` at root; see DEPENDENCIES.md).
4. Apply `supabase/full_setup.sql`; deploy the Edge Function; start the OCR service. See `HOW_TO_RUN.md`.

# Development Configuration
- Web: `npm run dev -w web` (Next dev server).
- Mobile: `npm run start -w Mobile` (Expo).
- OCR service locally: `uvicorn app.main:app --port 8000` with `PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT=False` if the Paddle CPU build requires it.
- Supabase local: `supabase start` (optional; hosted project used otherwise).

# Test Configuration
- Shared domain tests: run the `*.test.ts` scripts (see `shared/`); prior output captured in `shared/shared_test_out.txt`.
- Edge Function tests: `supabase/functions/ocr-extract/extract.test.ts`.
- OCR parser tests: `pytest ocr-service/tests` (requires `pytest` — ISSUE-007).

# Production Configuration
- Web: deploy with `NEXT_PUBLIC_*` env vars set in the host (Vercel/Netlify). Never expose service-role keys.
- Mobile: ship via EAS Build with `EXPO_PUBLIC_*` baked at build time. Never embed service-role keys.
- OCR service: private host, token-gated, reachable only by the Edge Function.
- Edge Function: `PADDLEOCR_URL` + `PADDLEOCR_TOKEN` must be set before deploy.

# External Services
| Service | Purpose | Required | Configuration |
|---|---|---|---|
| Supabase (Postgres + Auth + Storage + Functions) | DB, auth, buckets, edge | Yes | Project URL + anon key; `full_setup.sql`; function secrets |
| Self-hosted PaddleOCR service | OCR inference | Yes (scan features) | `OCR_SERVICE_TOKEN`; expose only to the Edge Function |
| Google Cloud Vision | Legacy OCR provider | No | Not used; remove references (ISSUE-003/004) |

# Configuration Changes
| Date | Change | Reason |
|---|---|---|
| 2026-09-18 | Baseline documented | Regeneration of workflow docs from audit |

# Configuration Verification
Last verified: 2026-09-18

Result:
NOT VERIFIED

Notes:
No Supabase project access, no `node_modules`, and no OCR service running in this environment. Verification must be added after setup (see VERIFICATION.md).
