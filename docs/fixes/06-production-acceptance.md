# Production Acceptance and Deployment Verification

Priority: High
Effort: Large
Session: 1
Estimated time: 90 minutes

## What is wrong

The audit could not confirm production readiness because live deployment configuration and runtime acceptance tests were not verified. Relevant checks include deployment documentation, Netlify configuration, frontend and backend environment examples, health endpoints, database migrations, and storage configuration. A successful local build alone does not prove that the deployed frontend, API, database, email, and file storage work together.

## Why it matters

Configuration drift or an unavailable dependency can prevent users from logging in, loading data, uploading files, or completing real workflows. Production acceptance should verify the deployed system without exposing secrets or making unapproved production changes.

## Files involved

- `docs/deploy.md` — verify documented deployment and acceptance steps.
- `netlify.toml` — verify the current frontend build and deployment configuration.
- `backend/.env.example` — verify documented backend environment variables.
- `web/.env.example` — verify documented frontend environment variables.
- `backend/src/main.ts` — verify application startup and health endpoint setup.
- `backend/src/common/storage/storage.service.ts` — verify storage configuration and failure behavior.
- `backend/prisma/migrations/20261013000000_add_task_blocker_fields/migration.sql` — verify this migration exists and is included in the deployment history before relying on it.
- Relevant hosting configuration and deployment logs — inspect through authorized provider access; do not commit secrets.

## Steps

1. Verify the current files and deployment instructions. Locate the health endpoints `/health/live` and `/health/ready`, and confirm their actual behavior in the current backend.
2. Inspect the deployed frontend and API configuration. Confirm `NEXT_PUBLIC_API_URL` points to the intended deployed API and that required email, storage, and other documented settings are configured. Never print or commit secret values.
3. Verify the database migration history and the documented deployment command `npm run migrate:deploy --workspace=backend`. Do not run migrations against production until the target environment, backup/recovery expectations, and authorization are confirmed.
4. Run acceptance checks against an approved test or staging deployment: frontend availability, API health, authentication, role-protected access, core data loading, file storage, and the relevant end-to-end workflows. Record failures with reproducible evidence.
5. Run the relevant automated checks and workspace builds. Use the current repository scripts and document any checks that cannot run; do not claim runtime acceptance based on a build alone.
6. Fix only confirmed deployment or acceptance defects in the relevant files. Review the diff and stage only those changes: `git add <reviewed-files>` followed by `git commit -m "test(deploy): verify production acceptance"`.
7. Confirm the intended branch and reviewed diff before pushing. If fixing `master`, use `git push origin master`. Deploy only through the approved deployment process and verify the resulting deployment.

## Acceptance criteria

- [ ] Required environment variables and public URLs have been verified without exposing secrets.
- [ ] Liveness and readiness endpoints have been checked on the intended deployment.
- [ ] Database migration state has been verified before any migration is run.
- [ ] Frontend, API, authentication, storage, and core workflows have been tested in an approved environment.
- [ ] Failures and skipped checks are documented accurately.
- [ ] No unapproved production changes or unrelated architecture changes are made.
- [ ] Relevant builds and automated checks pass.
- [ ] Commit pushed.

## Do NOT do

- Do not assume hosting configuration or production environment values are correct or incorrect without checking them.
- Do not commit credentials, API keys, connection strings, or other secrets.
- Do not run destructive database commands or unapproved production migrations.
- Do not invent environment variables, endpoints, or deployment workflows.
- Do not claim a production acceptance test passed if it was not executed.
- Do not modify unrelated files or include unrelated existing work in the commit.

## Notes

The audit did not include a live runtime acceptance test. Treat production readiness as unverified until the relevant checks have actually been performed.
