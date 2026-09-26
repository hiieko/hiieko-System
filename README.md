# HIIEKO — Solar Site Management System

A solar construction site management platform with web dashboard, mobile app,
and a unified NestJS API backed by PostgreSQL 18.

## Architecture

```
Web (Next.js) ─┐
                ├──→ NestJS :4000 ──→ Prisma ──→ PostgreSQL 18 :5432
Mobile (Expo) ─┘
```

- **PostgreSQL 18** — single source of truth
- **Prisma ORM** — schema migrations, type-safe queries
- **NestJS** — REST API with JWT auth, role guards, Swagger docs
- **Next.js** — web dashboard (Romanian locale)
- **Expo** — mobile app with offline SQLite sync queue
- **PaddleOCR** — self-hosted receipt OCR service (called server-side only)

## Quick start

See [HOW_TO_RUN.md](HOW_TO_RUN.md) for setup instructions.

## Repository layout

```
backend/          NestJS API server (src/modules/)
database/         Prisma migrations, ETL scripts, archive
Mobile/           Expo / React Native app
shared/           Shared types, translations, calculations (@solar/shared)
web/              Next.js web dashboard
docs/             Architecture decisions, roadmaps, AI instructions
Project workflow/ Status, issues, verification records
ocr-service/      Standalone PaddleOCR service (Docker)
```

## Development status

This is a **pre-1.0 development checkpoint**. Key milestones:

| Milestone | Status |
|---|---|
| PostgreSQL 18 migration | ✅ Complete |
| Supabase runtime removal | ✅ Complete |
| R2.2 Attendance | ✅ E2E verified |
| R2.3 Stock + Avize | ✅ E2E verified |
| R2.4 Daily Reports | ✅ E2E verified |
| R2.5 Notifications/Audit | ✅ E2E verified |
| R2.1 Sites→Projects (P1–P6) | ✅ **P6 CLOSURE (all 6 phases complete)** |

**Current work:** R2.1 P6 CLOSURE — Documentation reconciliation complete. R2.2 onward next.

For detailed status, see [Project workflow/CURRENT_STATUS.md](Project%20workflow/CURRENT_STATUS.md).

## Key documentation

| Document | Purpose |
|---|---|
| [Project workflow/CURRENT_STATUS.md](Project%20workflow/CURRENT_STATUS.md) | Canonical current-status summary |
| [Project workflow/PROGRESS.md](Project%20workflow/PROGRESS.md) | Detailed progress ledger |
| [Project workflow/VERIFICATION.md](Project%20workflow/VERIFICATION.md) | Verification evidence |
| [Project workflow/ISSUES.md](Project%20workflow/ISSUES.md) | Open and resolved issues |
| [Project workflow/IMPLEMENTATION_ROADMAP.md](Project%20workflow/IMPLEMENTATION_ROADMAP.md) | Phase roadmap (R0–R7) |
| [docs/HIIEKO_IMPLEMENTATION_DECISIONS.md](docs/HIIEKO_IMPLEMENTATION_DECISIONS.md) | Key architectural decisions |
| [docs/HIIEKO_MASTER_ROADMAP.md](docs/HIIEKO_MASTER_ROADMAP.md) | Execution roadmap |
| [HOW_TO_RUN.md](HOW_TO_RUN.md) | Setup and run instructions |

## Validation

```powershell
npm run typecheck   # TypeScript checks on all 4 workspaces
npm run test        # Backend Jest test suite
npm run build       # Build shared, web, and backend
npm run db:verify   # Database integrity checks (41 checks)
```
