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
- **PaddleOCR** — repository capability; OCR is currently frozen/deferred pending an explicit decision on proposed V1 inclusion

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

The repository is pre-1.0. Production deployment and end-to-end release acceptance are not established by this README. The October 20, 2026 audit records 48 backend test suites / 567 tests and a 35-route web build on its then-current baseline; those checks have not been rerun on the currently modified worktree. See [current status](Project%20workflow/CURRENT_STATUS.md) and [verification evidence](Project%20workflow/VERIFICATION.md).

## Key documentation

| Document | Purpose |
|---|---|
| [Project workflow/CURRENT_STATUS.md](Project%20workflow/CURRENT_STATUS.md) | Canonical current-status summary |
| [Project workflow/PROGRESS.md](Project%20workflow/PROGRESS.md) | Consolidated progress index |
| [Project workflow/VERIFICATION.md](Project%20workflow/VERIFICATION.md) | Verification evidence |
| [Project workflow/ISSUES.md](Project%20workflow/ISSUES.md) | Current issues, audit findings, and unresolved blockers |
| [Project workflow/DECISIONS.md](Project%20workflow/DECISIONS.md) | Canonical decisions and preserved legacy decision crosswalk |
| [docs/HIIEKO_IMPLEMENTATION_PLAN.md](docs/HIIEKO_IMPLEMENTATION_PLAN.md) | Single proposed V1 execution plan (scope approval pending) |
| [docs/V1_SCOPE.md](docs/V1_SCOPE.md) | Proposed V1 scope and acceptance criteria (not approval or completion evidence) |
| [HOW_TO_RUN.md](HOW_TO_RUN.md) | Setup and run instructions |

## Validation

```powershell
npm run typecheck   # TypeScript checks on all 4 workspaces
npm run test        # Backend Jest test suite
npm run build       # Build shared, web, and backend
  npm run db:verify   # Read-only database integrity checks (check count depends on current code)
```
