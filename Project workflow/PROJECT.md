# Project

## Project Name
HIIEKO â€” Solar Site Management System (`solar-site-management-system` v1.0.0)

## Description
An integrated management platform for solar photovoltaic construction sites in Romania. It coordinates daily worker attendance (GPS/geofence based), team-leader daily reports, supplier delivery notes and site stock, company expense management with camera-based receipt OCR (PaddleOCR), expense approval workflows, notifications, account applications, and site statistics â€” through a web dashboard and a mobile workforce app, with a PostgreSQL/Prisma/NestJS backend.

## Purpose
Replace manual paper-based site records with a single source of truth per site, remain usable in low-connectivity conditions (offline queue), and enforce company policy in the database (permissions/RLS, no negative stock, no self-approval of expenses).

## Target Users
- Workers (`worker` role): mobile attendance check-in/out, submit expenses with receipts.
- Team leaders (`team_leader` role): daily reports, delivery reception, stock status.
- Managers (`manager` role): approve expenses, review reports, track stock and statistics.
- Admins (`admin` role): user/role management, account applications, site administration.

## Current Stage
- Status: **STABLE** (production backend, verified end-to-end; mobile auth pending)
- Version: 1.0.0
- Last Updated: 2026-09-22

## Technology Stack
- Language: TypeScript/TSX, Python, SQL/PLpgSQL
- Framework: Next.js 14 (web), Expo 51 / React Native 0.74 (mobile), FastAPI (OCR service), PaddleOCR 3.x
- Runtime: Node.js (recommended 20 LTS; 24.x present here), Python 3.12+
- **Backend: NestJS + Prisma + PostgreSQL 18** (Supabase fully removed from runtime on 2026-09-23)
- Frontend: Next.js App Router (NestJS API client), React Native
- Infrastructure: npm workspaces monorepo; Docker (ocr-service)
- Testing: Jest (backend, 15 suites / 125 tests), tsx/`node --test`-style scripts in `shared`, pytest suite in `ocr-service`

## Architecture Overview
Monorepo with four workspaces. `shared` holds pure domain logic (types, calculations, i18n, permission helpers, OCR normalization) reused by web, mobile and tests. `web` and `Mobile` are thin clients over the NestJS REST API protected by JWT authentication and project-scoped guards. The OCR path is: mobile/web camera â†’ NestJS upload â†’ PaddleOCR service (server-side) â†’ client review of low-confidence fields â†’ approval. All authorization runs in the NestJS middleware layer (guards, decorators). See `docs/`, `README.md`, and `HOW_TO_RUN.md`.

> **âš ï¸ HISTORICAL / SUPERSEDED:** The earlier Supabase-based architecture (RLS policies, Edge Functions, Supabase Storage, `supabase/full_setup.sql` as the schema source) was fully decommissioned on 2026-09-23. The current authoritative backend is NestJS + Prisma + PostgreSQL 18. References to Supabase in the Important Directories and Important Files sections below are retained for historical documentation of the migration path.

## Important Directories
| Directory | Purpose |
|---|---|
| `shared/` | Domain types, calculations, i18n, tutorials, OCR helpers (workspace `@solar/shared`) |
| `web/` | Next.js web dashboard (workspace `@solar/web`) |
| `Mobile/` | Expo / React Native mobile app (workspace `@solar/mobile`) |
| `supabase/` | SQL migrations, `full_setup.sql`, Edge Function `ocr-extract` |
| `ocr-service/` | Self-hosted FastAPI + PaddleOCR document recognition service |
| `Project workflow/` | Project documentation (requirements, progress, issues, decisions, handoff) |
| `docs/` | Source-of-truth documentation (incl. `AI_INSTRUCTIONS.md`) |

## Important Files
| File | Purpose |
|---|---|
| `README.md` | Repository overview and reference root |
| `HOW_TO_RUN.md` | Setup / configuration / run / deploy steps |
| `shared/src/types.ts` | Core domain model |
| `shared/src/calculations.ts` | Attendance/geofence/stock business rules |
| `shared/src/permissions.ts` | Role/permission rules |
| `supabase/full_setup.sql` | Consolidated one-shot database artifact |
| `supabase/functions/ocr-extract/index.ts` | OCR proxy Edge Function (PaddleOCR) |
| `ocr-service/app/main.py` | Private OCR HTTP service |

## Development Workflow (CURRENT)
Install with `npm install` at the repository root (npm workspaces install all workspaces; `shared/dist` must be built first for web/mobile). Copy `.env.example` to `.env` in each workspace. The NestJS backend runs on port 4000. Prisma migrations are managed via `npx prisma migrate deploy` in `backend/`. Detailed steps are in `HOW_TO_RUN.md`.

> **⚠️ HISTORICAL / SUPERSEDED:** The previous workflow referenced Supabase setup (`NEXT_PUBLIC_SUPABASE_URL`, anon key, `supabase/full_setup.sql`, Edge Function deployment). These are no longer required. Supabase was fully removed from the runtime on 2026-09-23.


## Definition of Done
A feature is complete when:
- Requirements are implemented.
- Relevant tests pass.
- Build/type/lint checks pass where applicable.
- Configuration is documented.
- Dependencies are documented.
- Known issues are recorded.
- Documentation is updated.
- Handoff is current.

## Important Notes
- All web pages are now live with real API calls to the NestJS backend.
- Mobile `App.tsx` currently uses a hardcoded demo user; `LoginScreen.tsx` is implemented but not wired in (ISSUE-002).
- UI copy is Romanian-first with a `ro`/`en` i18n layer in `shared`.

