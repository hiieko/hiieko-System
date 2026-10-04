# HIIEKO AGENTS GUIDELINES

## Production Architecture
HIIEKO production architecture is AUTHORITATIVE:
- **web** = Next.js
- **backend** = NestJS  
- **Prisma/PostgreSQL**
- **shared**
- **Mobile**

v0 is a visual/workflow reference ONLY. Never wholesale-merge v0.

## Core Principles
- Preserve login/register/session/refresh-token behavior
- Preserve organization and project authorization
- No fake/mock persistence
- No fake IDs
- No localStorage-as-database
- Inspect before editing
- Implement only requested scope
- Verify after implementation
- Stop when task is complete

## Windows PowerShell Command Discipline
- Do NOT use Unix-only commands such as grep/head/tail/wc/sed/awk/rm/cp/mv
- Use PowerShell equivalents (Get-Content, Select-String, etc.)
- Chain with ; only; use conditionals when dependent
- Avoid changing directories inside commands - use workdir parameter

## Database Safety Rules
- NEVER change DATABASE_URL
- NEVER modify backend/.env
- NEVER run prisma migrate reset
- NEVER run prisma db push
- NEVER run prisma db pull
- NEVER apply migrations unless explicitly authorized by a database deployment task
- No destructive SQL unless explicitly authorized

## Git Safety
- NEVER force push
- NEVER reset hard
- NEVER clean unknown files blindly
- Review staged diff before commit
- NEVER commit secrets
