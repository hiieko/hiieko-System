\# HIIEKO — Phase 6 Functional

\# Hardening



Branch: `functional/phase-6-hardening`

Time: 10 to 12 hours (4 sessions)



\## What this phase does



Phases 0 through 5 made the app work.

Phase 6 makes it safe to run with real users, real data, and real

consequences.



After this phase:



\- The system resists common attacks

\- Data is backed up and recoverable

\- Problems are visible before users report them

\- The system performs under load

\- You can sleep at night



\## What this phase is not



Phase 6 is not:



\- A new feature

\- A design change

\- A performance rewrite

\- A security audit by a third party



Phase 6 is only: make the system production-grade.



\## Why this phase matters



Right now the app works. But "works" and "safe" are different things.



A working app:



\- Anyone can hammer the login endpoint

\- A database failure loses a day of work

\- A bug runs silently for weeks

\- A slow query blocks the whole site

\- A stolen token stays valid for 15 minutes

\- Nobody notices until a user complains



A hardened app:



\- Rate limits prevent abuse

\- Backups allow recovery

\- Errors are logged and alertable

\- Slow queries are identified and fixed

\- Sessions can be revoked instantly

\- Problems are caught before users see them



Phase 6 closes that gap.



\## The six areas of hardening



1\. Authentication and authorization hardening

2\. Input validation and injection prevention

3\. Rate limiting and abuse prevention

4\. Data integrity and backups

5\. Observability: logging, metrics, alerts

6\. Performance: indexes, query review, caching



\---



\# Area 1 — Authentication and authorization



\## What is already correct (per the audit)



\- JWT with sid claim

\- Refresh token rotation

\- Refresh tokens stored hashed

\- Server-side roles guard

\- Project access guards

\- Rate limiting on auth routes

\- httpOnly refresh cookie



\## What still needs hardening



1\. Session revocation on password change

&#x20;  When a user changes their password, revoke every active session.

&#x20;  Add to the change-password handler:

&#x20;  - Update password

&#x20;  - Delete all Session rows for that user

&#x20;  - Delete all RefreshToken rows for those sessions

&#x20;  - Force re-login



2\. Session revocation on role change

&#x20;  When an admin changes a user's role, revoke their sessions.

&#x20;  This prevents a demoted user from keeping elevated access until

&#x20;  their token expires.



3\. Idle session timeout

&#x20;  Sessions should expire after a period of inactivity.

&#x20;  Recommended: 30 days absolute, 7 days idle.

&#x20;  Add a last\_used\_at check on every authenticated request.

&#x20;  If idle too long, revoke and return 401.



4\. Password policy

&#x20;  Enforce a minimum:

&#x20;  - 8 characters minimum

&#x20;  - Not a common password (check against a small blocklist)

&#x20;  - Not the user's email

&#x20;  Do not enforce "must have uppercase, number, symbol" — it degrades

&#x20;  security in practice.



5\. Failed login lockout

&#x20;  The audit confirms rate limiting exists. Confirm the policy:

&#x20;  - Per email: 5 failed attempts per 15 minutes

&#x20;  - Per IP: 20 failed attempts per 15 minutes

&#x20;  Both must be enforced, not just one.



6\. JWT secret strength

&#x20;  Confirm JWT\_SECRET is at least 32 bytes of random data.

&#x20;  Confirm it is NOT the same as the development secret.

&#x20;  Confirm it is stored only in environment variables, never in code.



7\. Refresh token reuse detection

&#x20;  If a refresh token is used twice, that is a sign of theft.

&#x20;  On detection: revoke the session, force re-login.

&#x20;  Confirm the current refresh logic does this. If not, add it.



8\. Admin action audit

&#x20;  Every action by admin or owner that changes another user

&#x20;  (role change, status change, delete) must be logged in AuditLog

&#x20;  with the actor's id. This is already partially present per the

&#x20;  audit. Confirm coverage is complete.



\---



\# Area 2 — Input validation and injection prevention



\## What is already correct (per the audit)



\- Global ValidationPipe with whitelist

\- class-validator on DTOs

\- Prisma ORM (no raw SQL except health check)

\- CORS allowlist

\- Upload MIME allowlist and size limit



\## What still needs hardening



1\. DTO completeness audit

&#x20;  For every POST, PATCH, and PUT endpoint:

&#x20;  - Confirm a DTO class exists

&#x20;  - Confirm every field has a class-validator decorator

&#x20;  - Confirm no field accepts arbitrary data without validation

&#x20;  Do this for every controller. It is tedious but it is the single

&#x20;  most important validation check.



2\. Reject unknown fields

&#x20;  The audit says forbidNonWhitelisted is currently false.

&#x20;  Change it to true. Any request with extra fields is rejected.

&#x20;  This prevents parameter pollution and future exploit patterns.



3\. Query parameter validation

&#x20;  GET endpoints often have query params (filters, pagination).

&#x20;  These are also user input.

&#x20;  For every GET with query params:

&#x20;  - Validate types (page is a number, sort is an enum)

&#x20;  - Validate ranges (page size max 100)

&#x20;  - Reject unknown params

&#x20;  Do this with a DTO on the query too.



4\. File upload hardening

&#x20;  Per the audit:

&#x20;  - MIME allowlist exists

&#x20;  - Size limit exists

&#x20;  - Storage path protection exists

&#x20;  Confirm:

&#x20;  - The filename is never used as the storage key

&#x20;  - The file extension is derived from MIME, not from the user

&#x20;  - Uploaded files are stored outside the web root

&#x20;  - No file is executed, only served as static content with the

&#x20;    correct Content-Type



5\. XSS prevention

&#x20;  React escapes by default. Confirm:

&#x20;  - No component uses dangerouslySetInnerHTML with user input

&#x20;  - Search the codebase for dangerouslySetInnerHTML

&#x20;  - If any usage exists, sanitize with DOMPurify or remove



6\. SQL injection

&#x20;  Prisma is safe for typed queries.

&#x20;  Confirm:

&#x20;  - No use of prisma.$queryRawUnsafe with user input

&#x20;  - The health check use has no user input

&#x20;  - No raw SQL anywhere else



7\. Response header hardening

&#x20;  Add these headers via the backend (helmet or manual):

&#x20;  - X-Content-Type-Options: nosniff

&#x20;  - X-Frame-Options: DENY

&#x20;  - Strict-Transport-Security: max-age=31536000

&#x20;  - Referrer-Policy: strict-origin-when-cross-origin

&#x20;  - Content-Security-Policy: minimal viable policy for the frontend

&#x20;  Verify with a security headers scanner after deploy.



\---



\# Area 3 — Rate limiting and abuse prevention



\## What is already correct



\- Rate limiting on auth routes



\## What still needs hardening



1\. Rate limit every public endpoint

&#x20;  Not just auth. Every endpoint that:

&#x20;  - Writes data (POST, PATCH, DELETE)

&#x20;  - Costs real money (OCR, email sending)

&#x20;  - Is expensive to compute (Control Tower aggregation)



&#x20;  Recommended defaults:

&#x20;  - Read: 100 requests per minute per user

&#x20;  - Write: 30 requests per minute per user

&#x20;  - Auth: 5 per 15 minutes per email

&#x20;  - OCR: 10 per hour per user

&#x20;  - Email send: 5 per hour per user



2\. Rate limit by user, not only by IP

&#x20;  IP-based limits are easy to evade (mobile networks).

&#x20;  User-based limits are per authenticated user.

&#x20;  Apply both.



3\. Global circuit breaker

&#x20;  If a specific user or IP is hammering the system, block them

&#x20;  temporarily.

&#x20;  Recommended: 3x the rate limit triggers a 15-minute block.

&#x20;  Log the block. Alert if it happens more than 3 times per hour.



4\. Request size limits

&#x20;  Per the audit, MAX\_FILE\_SIZE exists for uploads.

&#x20;  Add a global body size limit:

&#x20;  - JSON: 1 MB

&#x20;  - Form data: MAX\_FILE\_SIZE

&#x20;  Any request larger is rejected with 413.



5\. Slowloris protection

&#x20;  Most Node.js deployments handle this via the reverse proxy.

&#x20;  Confirm Render (or whatever host) has a read timeout configured.

&#x20;  Recommended: 30 seconds max per request.



\---



\# Area 4 — Data integrity and backups



\## What still needs hardening



1\. Automated database backups

&#x20;  The database is the most valuable asset.

&#x20;  Configure:

&#x20;  - Daily full backup

&#x20;  - Retained for 30 days

&#x20;  - Weekly backup retained for 90 days

&#x20;  - Monthly backup retained for 12 months



&#x20;  On Render or Neon: both offer automated backups on paid tiers.

&#x20;  On the free tier, back up manually via pg\_dump to an S3-compatible

&#x20;  bucket (Backblaze B2, Cloudflare R2, or AWS S3).



2\. Backup verification

&#x20;  A backup that has never been restored is not a backup.

&#x20;  Once a month, restore the latest backup to a staging database.

&#x20;  Confirm it works.

&#x20;  Document the restore steps in `docs/restore.md`.



3\. Point-in-time recovery

&#x20;  If your host supports it, enable it.

&#x20;  This allows restoring to the exact moment before a bad migration.



4\. Migration rollback plan

&#x20;  Every migration must be reversible.

&#x20;  For each migration, know the rollback SQL.

&#x20;  Test the rollback on staging before applying the migration to

&#x20;  production.



5\. Foreign key integrity

&#x20;  The audit found some models without explicit Prisma relations

&#x20;  (TaskDependency, Commitment, Payment, Attachment).

&#x20;  For each of these:

&#x20;  - Add the Prisma relation if the data should be enforced

&#x20;  - Or document why it is intentionally unlinked

&#x20;  Unlinked foreign keys cause silent data corruption over time.



6\. Soft delete policy

&#x20;  Right now, is DELETE a hard delete or a soft delete?

&#x20;  For user-facing data (tasks, projects, reports), soft delete is

&#x20;  safer:

&#x20;  - Add deleted\_at timestamp

&#x20;  - Every query filters deleted\_at IS NULL

&#x20;  - Admin can restore

&#x20;  Decide the policy and apply it consistently.



7\. Data validation on read

&#x20;  Occasionally a bad row makes it into the database.

&#x20;  Add a periodic check job that scans for invariant violations:

&#x20;  - Task with actual\_quantity > planned\_quantity \* 2

&#x20;  - Attendance check\_out before check\_in

&#x20;  - StockBalance with negative quantity

&#x20;  Log every violation. Alert if more than 5 per day.



\---



\# Area 5 — Observability: logging, metrics, alerts



\## What is already correct



\- Structured request logging

\- Global exception filter

\- Production hides internal errors behind generic message



\## What still needs hardening



1\. Log aggregation

&#x20;  Logs go to stdout. On Render, they are visible but not searchable.

&#x20;  Add a log aggregator:

&#x20;  - Option A: Better Stack (free tier)

&#x20;  - Option B: Logtail (free tier)

&#x20;  - Option C: Self-hosted Grafana Loki



&#x20;  Send structured JSON logs. Include:

&#x20;  - request\_id

&#x20;  - user\_id (when authenticated)

&#x20;  - route

&#x20;  - status

&#x20;  - duration\_ms



&#x20;  Never log: passwords, tokens, cookies, request bodies of auth routes.



2\. Error tracking

&#x20;  Add Sentry (free tier) for both backend and frontend.

&#x20;  On every unhandled error:

&#x20;  - Send to Sentry

&#x20;  - Include user\_id, route, request\_id

&#x20;  - Group errors by fingerprint



&#x20;  Alert on:

&#x20;  - A new error type

&#x20;  - An error rate above 1 percent of requests



3\. Key metrics

&#x20;  Track and expose:

&#x20;  - Request count per route

&#x20;  - Error rate per route

&#x20;  - Average response time per route

&#x20;  - Active users per day

&#x20;  - Database query duration

&#x20;  - Cron job success and failure



&#x20;  Use the built-in NestJS metrics module or add prom-client.

&#x20;  Expose at /metrics (protected by IP allowlist or auth).



4\. Health check endpoint

&#x20;  Add /api/health returning:

&#x20;  - status: ok or degraded

&#x20;  - checks: database reachable, migrations current, disk writable

&#x20;  - version

&#x20;  - timestamp



&#x20;  The audit found a health check exists. Confirm it checks the

&#x20;  database and returns a proper status.



5\. Uptime monitoring

&#x20;  Free options: Better Stack, UptimeRobot, Healthchecks.io.

&#x20;  Monitor:

&#x20;  - Frontend homepage returns 200

&#x20;  - Backend /api/health returns 200

&#x20;  - Every 60 seconds

&#x20;  Alert on 2 consecutive failures.



6\. Alerts

&#x20;  Configure alerts for:

&#x20;  - Error rate spike

&#x20;  - Login failure spike

&#x20;  - Database connection failure

&#x20;  - Response time above 3 seconds

&#x20;  - Disk usage above 80 percent

&#x20;  Route alerts to email or Slack.



7\. Audit log retention

&#x20;  The AuditLog table grows forever.

&#x20;  Decide retention:

&#x20;  - Keep everything for 12 months

&#x20;  - Archive older to cold storage

&#x20;  Add a monthly job that moves old entries to an archive table or

&#x20;  storage bucket.



\---



\# Area 6 — Performance: indexes, queries, caching



\## What still needs hardening



1\. Query audit

&#x20;  Open the slow query log on the database (Render and Neon both have

&#x20;  one). Identify:

&#x20;  - Queries over 500ms

&#x20;  - Queries run more than 100 times per minute

&#x20;  For each, add an index or fix the query.



2\. Required indexes

&#x20;  Add these if not already present:

&#x20;  - Task.project\_id

&#x20;  - Task.status

&#x20;  - Task.planned\_end

&#x20;  - Task.assignee\_id (via TaskAssignment)

&#x20;  - Issue.project\_id

&#x20;  - Issue.status

&#x20;  - Issue.severity

&#x20;  - DailyReport.project\_id

&#x20;  - DailyReport.status

&#x20;  - DailyReport.report\_date

&#x20;  - Attendance.user\_id

&#x20;  - Attendance.project\_id

&#x20;  - Attendance.date

&#x20;  - AuditLog.created\_at

&#x20;  - AuditLog.project\_id

&#x20;  - Notification.user\_id

&#x20;  - Notification.is\_read

&#x20;  - Session.user\_id

&#x20;  - Session.expires\_at



&#x20;  Composite indexes where queries filter on multiple fields:

&#x20;  - Task (project\_id, status)

&#x20;  - DailyReport (project\_id, status, report\_date)

&#x20;  - Attendance (user\_id, date)

&#x20;  - AuditLog (project\_id, created\_at)



3\. N+1 query elimination

&#x20;  In list endpoints, if the frontend requests a list and each item

&#x20;  triggers another query, that is an N+1.

&#x20;  Fix with Prisma include or a single join.



&#x20;  Common offenders:

&#x20;  - Task list with assignees

&#x20;  - Project list with clients

&#x20;  - Report list with reviewers



&#x20;  Check every list endpoint.



4\. Pagination everywhere

&#x20;  Every list endpoint must support pagination.

&#x20;  Default page size: 25

&#x20;  Max page size: 100

&#x20;  Cursor-based for large datasets (activity, audit).

&#x20;  Offset-based for small lists.

&#x20;  Never return an unbounded list.



5\. Response size limits

&#x20;  Cap the number of items in any response.

&#x20;  Cap total response size at 1 MB.

&#x20;  If a response would exceed, return 413 or paginate.



6\. Caching (careful)

&#x20;  Cache only what is safe:

&#x20;  - Static config (module lists, enums): cache forever

&#x20;  - Dashboard aggregations: cache for 60 seconds

&#x20;  - Never cache user-specific data without a per-user key

&#x20;  Use Redis or in-memory LRU.

&#x20;  Do not add caching in Phase 6 unless you have proof of a problem.



7\. Frontend performance

&#x20;  - Bundle size: check with Next.js analyzer. Anything over 300 KB

&#x20;    gzipped needs attention.

&#x20;  - Lazy load heavy components (Solar Configurator, PDF viewers).

&#x20;  - Use next/image for images.

&#x20;  - Use next/font for fonts.

&#x20;  - Confirm no layout shift on page load.



\---



\# What Phase 6 changes



Backend:



\- Add forbidNonWhitelisted: true

\- Add query DTOs

\- Add validation on every query param

\- Add session revocation on password change

\- Add session revocation on role change

\- Add idle timeout logic

\- Add refresh token reuse detection

\- Add security headers via helmet

\- Add rate limits beyond auth

\- Add global body size limits

\- Add indexes via migration

\- Add Sentry

\- Add metrics endpoint

\- Add better health check

\- Fix N+1 queries

\- Add pagination to every list



Infrastructure:



\- Configure backups on the database host

\- Configure log aggregation

\- Configure uptime monitoring

\- Configure alerts

\- Configure a staging environment



Docs:



\- `docs/restore.md` — how to restore from backup

\- `docs/incident-response.md` — what to do when something breaks

\- `docs/runbook.md` — common operations



\# What Phase 6 removes



\- The option for unbounded list responses

\- The ability for extra fields to pass validation

\- The possibility of a session surviving a password change

\- Silent database errors

\- The "I hope it works" feeling



\# How to test Phase 6



Test 1 — Validation



\- Send a POST with an extra unknown field

\- Expect: 422 with validation error



Test 2 — Rate limit



\- Send 100 requests to an endpoint in 10 seconds

\- Expect: 429 after the limit



Test 3 — Session revocation



\- Log in

\- Change password

\- Expect: the old session is rejected on next request



Test 4 — Idle timeout



\- Log in

\- Wait longer than the idle timeout (or mock the timestamp)

\- Expect: 401



Test 5 — Refresh token reuse



\- Log in

\- Copy the refresh cookie

\- Refresh once (rotates the token)

\- Manually send the old refresh token again

\- Expect: session revoked, forced re-login



Test 6 — SQL injection attempt



\- Send a task title like: '); DROP TABLE users; --

\- Expect: stored as literal string, no SQL executed



Test 7 — XSS attempt



\- Create an issue with title: <script>alert(1)</script>

\- Expect: rendered as text, not executed



Test 8 — Security headers



\- Open the site, inspect response headers

\- Expect: all headers from Area 2 present

\- Score A or better on securityheaders.com



Test 9 — Upload hardening



\- Upload a .exe file

\- Expect: rejected by MIME allowlist

\- Upload a 50 MB file

\- Expect: rejected by size limit



Test 10 — Backup restore



\- Download the latest backup

\- Restore to a staging database

\- Expect: the staging database matches production within the

&#x20; backup window



Test 11 — Indexes



\- Run EXPLAIN ANALYZE on the Control Tower overview query

\- Expect: no sequential scans on large tables

\- Expect: query under 100ms



Test 12 — N+1



\- Open the task list

\- Watch the database log

\- Expect: 1 query for the list, not 1 per task



Test 13 — Error tracking



\- Trigger a 500 by sending malformed data

\- Expect: it appears in Sentry within 60 seconds



Test 14 — Alerting



\- Kill the backend process on staging

\- Expect: uptime monitor alerts within 3 minutes



Test 15 — Load test



\- Use k6 or Artillery to simulate 100 concurrent users

\- Expect: no 500s

\- Expect: p95 response time under 1 second

\- Expect: database CPU under 70 percent



\# Session execution



Phase 6 is the longest phase. Do it in 4 sessions.



Session A — Validation and security (3 hours):



1\. Turn on forbidNonWhitelisted

2\. Audit DTOs

3\. Add query DTOs

4\. Add helmet

5\. Add security headers

6\. Test with securityheaders.com



Session B — Auth hardening (2 to 3 hours):



1\. Session revocation on password change

2\. Session revocation on role change

3\. Idle timeout

4\. Refresh token reuse detection

5\. Test each behavior



Session C — Backups, monitoring, alerts (2 to 3 hours):



1\. Configure backups on the DB host

2\. Write docs/restore.md

3\. Restore a backup to staging to verify

4\. Add Sentry

5\. Add uptime monitoring

6\. Configure alerts



Session D — Performance (3 hours):



1\. Add indexes via migration

2\. Fix N+1 queries

3\. Add pagination everywhere

4\. Load test

5\. Fix any performance issues found

6\. Open PR

7\. Test on preview

8\. Merge to main



\# Do not do in Phase 6



\- Do not add new features

\- Do not redesign pages

\- Do not refactor working code for elegance

\- Do not add caching without proof of need

\- Do not add tracing (OpenTelemetry) unless you have a specific need

\- Do not rewrite the auth system



Phase 6 is only: make it safe and observable.



\# Done criteria



Phase 6 is done when:



\- Every DTO is complete

\- Unknown fields are rejected

\- Every query param is validated

\- Sessions are revoked on password and role change

\- Idle timeout is enforced

\- Refresh token reuse is detected

\- Security headers are present

\- Rate limits cover every write endpoint

\- Backups run automatically and are verified monthly

\- Every error reaches Sentry

\- Uptime monitoring alerts within 3 minutes

\- Slow queries are indexed

\- Every list endpoint is paginated

\- Load test passes with 100 concurrent users

\- All 15 tests pass

\- `docs/restore.md`, `docs/incident-response.md`, `docs/runbook.md` exist



\# How long Phase 6 takes



Roughly 10 to 12 hours of focused work over 4 sessions.



This is not a rush phase. If you cut corners here, you will pay later.

Take the time. Do it properly.



\# How this connects to Phase 7



Phase 7 is Sales expansion.

Phase 6 makes the current system safe.

Phase 7 adds a new surface on top.



Do Phase 6 first. Phase 7 will inherit the safety, logging, and

monitoring automatically because it will use the same infrastructure.



\# After Phase 6, the system is production-grade



When Phase 6 is done:



\- You can onboard real customers

\- You can sleep when something breaks

\- You can recover from a disaster

\- You can see problems before users report them

\- You can scale to hundreds of users without redesign



That is what hardening means.

