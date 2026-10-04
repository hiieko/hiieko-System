# HIIEKO OpenCode Handover

## Repository

HIIEKO Solar Site Management System.

Architecture:
- web: Next.js 14
- backend: NestJS 10
- Prisma 5
- PostgreSQL
- shared
- Mobile

## Permanent OpenCode Rules

Production architecture is authoritative.

The v0 branch is a visual and workflow reference only. Never wholesale-merge v0.

Preserve:
- login/register/session/refresh-token behavior
- organization authorization
- project authorization
- existing production architecture

Never use:
- fake IDs
- mock persistence
- localStorage as a database
- simulated APIs

Always:
- inspect before editing
- implement only the requested scope
- verify after implementation
- stop when the task is complete

Windows PowerShell:
- use Get-ChildItem
- use Get-Content
- use Select-String
- use Select-Object
- use Test-Path
- use Remove-Item
- use Copy-Item
- use Move-Item
- use semicolons for command chaining

Avoid Unix-only commands such as grep, head, tail, wc, sed, awk, rm, cp and mv.

## Database Safety

Never change backend/.env.

Never change DATABASE_URL.

Never run without explicit authorization:
- prisma migrate reset
- prisma db push
- prisma db pull
- destructive SQL
- production database migrations

The database must be verified before any migration/deployment decision.

## Git Safety

Never force-push.

Never use git reset --hard.

Never use git clean blindly.

Review the staged diff before every commit.

Never commit:
- .env files
- credentials
- JWT secrets
- API keys
- OpenCode authentication files
- local progress logs
- temporary inspection files

## Documents

The production Documents frontend has intentionally been deferred.
Do not resurrect the old v0 local/mock Documents implementation.

## Current State

Completed:
- production Documents frontend WIP removed
- Prisma/database audit completed
- Users/Roles/RBAC audit completed
- OpenCode portable project setup added

Database:
- Prisma schema validates
- live PostgreSQL connectivity still needs verification before database deployment work

## Next Major Product Task

Implement the full production Users + Roles/RBAC feature:
- real backend behavior
- Prisma-backed roles/permissions
- organization/project scope preserved
- frontend Users/Roles UX based on v0 as reference only
- no mock/local persistence
- full verification after implementation

## New Laptop Workflow

1. Clone the GitHub repository.
2. Install dependencies.
3. Install/use the same OpenCode version.
4. Configure provider credentials locally.
5. Create local environment files without committing them.
6. Open the repository root.
7. OpenCode automatically reads AGENTS.md and project configuration.
8. Continue with the next implementation task.
