\# HIIEKO — Phase 3 Functional

\# Missing Features



Branch: `functional/phase-3-missing`

Time: 5 to 7 hours (3 sessions)



\## What this phase does



Phases 0, 1, and 2 made the existing features work end to end.



Phase 3 adds the features that are genuinely missing.



After this phase:



\- Users can reset their password

\- Photos attach to tasks, reports, and issues

\- The backend is deployed and reachable from the frontend

\- Production database is migrated

\- The audit's TOP 10 BLOCKERS list is fully closed



\## What this phase is not



Phase 3 is not:



\- A design phase (D0 to D7 handled that)

\- A wiring phase (Phase 2 handled that)

\- A new product feature beyond the four items below

\- A rewrite of anything working



Phase 3 is only: the four missing pieces.



\## The four missing pieces



1\. Password reset

2\. Photo workflow

3\. Backend hosting

4\. Production database migration



Do them in this order. Each is independent but hosting is a prerequisite

for the others to be testable in production.



\---



\# Piece 1 — Password reset



\## Why it is missing



The audit found:



\- No /api/auth/forgot-password endpoint

\- No /api/auth/reset-password endpoint

\- No /forgot-password frontend page

\- The login page may link to it, but the link is dead



\## What to build



\### Backend — two new endpoints



POST /api/auth/forgot-password



\- Body: { email }

\- Behavior: if the email exists, generate a reset token, store it with

&#x20; an expiry (30 minutes is standard), send an email with a reset link

\- Response: always 200, regardless of whether the email exists

&#x20; (do not reveal whether an account exists)

\- Rate limit this endpoint. 3 requests per email per hour.



POST /api/auth/reset-password



\- Body: { token, newPassword }

\- Behavior: look up the token, check it is not expired, check it is not

&#x20; used, hash the new password, update the user, invalidate the token,

&#x20; revoke all active sessions for that user

\- Response: 200 on success, 400 on invalid or expired token



\### Backend — database



Add a PasswordResetToken model in Prisma:



\- id

\- user\_id

\- token\_hash (never store the raw token)

\- expires\_at

\- used\_at (nullable)

\- created\_at



Create a migration.



\### Backend — email sending



\- Options: Resend, SendGrid, Mailgun, Postmark

\- All have free tiers

\- Choose one, add the API key to backend .env

\- Send a simple email: subject "Reset your HIIEKO password", body with

&#x20; a link to `https://your-netlify-url/forgot-password/reset?token=XXX`



\### Frontend — two new pages



`/forgot-password`



\- Email input

\- Submit button

\- On success: "Check your email for a reset link"

\- Never reveal whether the email exists



`/forgot-password/reset`



\- Reads token from query string

\- New password input

\- Confirm password input

\- Submit button

\- On success: toast "Password reset. Sign in." and redirect to /login

\- On expired token: "This link has expired. Request a new one."



\### Frontend — link



\- On /login, the "Forgot password?" link points to /forgot-password

\- Remove it from D1 if it was hidden



\---



\# Piece 2 — Photo workflow



\## Why it is missing



The audit found:



\- The Attachment model exists in Prisma

\- The upload endpoint exists at POST /api/upload

\- But there is no complete construction-specific flow:

&#x20; Task to Photo, Daily Report to Photo, Issue to Photo, QA to Photo



\## What to build



The Attachment model already supports any target via target\_type and

target\_id. Use it.



Target types to support:



\- task

\- daily\_report

\- issue

\- inspection

\- project (for general site photos)



\### Backend — confirm the upload endpoint



\- POST /api/upload accepts a file

\- Returns a stored file reference

\- Already exists per the audit



\### Backend — add a helper endpoint (or use existing)



POST /api/attachments



\- Body: { target\_type, target\_id, file\_id, caption? }

\- Creates an Attachment row linking the uploaded file to the target



If this does not exist, add it.



\### Frontend — a reusable PhotoUpload component



Props:



\- targetType

\- targetId

\- onChange (callback when a photo is added or removed)



Behavior:



\- Shows existing photos as thumbnails

\- "Add photo" button opens the file picker

\- On mobile, opens the camera directly

&#x20; (`input accept="image/\*" capture="environment"`)

\- Uploads via POST /api/upload

\- On success, calls POST /api/attachments with the returned file id

\- Shows a thumbnail grid

\- Tap a thumbnail to view full size

\- Swipe to remove (with confirm)



Use this component on:



\- Task detail page (Photos tab)

\- Daily report form (Photos section)

\- Issue detail page (Photos section)

\- QA inspection detail (Photos per item)

\- Project detail (Site photos tab)



\---



\# Piece 3 — Backend hosting



\## Why it is missing



The audit found:



\- Netlify is configured for the frontend

\- The backend is a NestJS server

\- No repository configuration defines where the backend runs in production

\- Therefore the deployed frontend cannot reach a backend



\## What to build



Choose one host. Recommended: Render.com.

Free tier. Handles Node.js. Auto-deploys from GitHub. Has a public URL.



Steps:



1\. Create a Render account

2\. New Web Service

3\. Connect to github.com/hiieko/hiieko-System

4\. Select the backend folder as the root

5\. Build command: `npm ci` then `npm run build --workspace=backend`

6\. Start command: `node backend/dist/main.js`

7\. Add environment variables from backend/.env.example:

&#x20;  - DATABASE\_URL (from your production Postgres)

&#x20;  - JWT\_SECRET (generate a new random one, do not reuse dev)

&#x20;  - JWT\_EXPIRES\_IN

&#x20;  - PORT (Render sets this automatically, but define it)

&#x20;  - NODE\_ENV=production

&#x20;  - COMPANY\_TZ

&#x20;  - CORS\_ORIGIN=https://your-netlify-url.netlify.app

&#x20;  - STORAGE\_DRIVER

&#x20;  - STORAGE\_ROOT

&#x20;  - PADDLEOCR\_\* if using OCR

&#x20;  - MAX\_FILE\_SIZE

8\. Deploy

9\. Open the public URL and hit /api/health or the root, expect a response



\### Netlify side



\- Open Netlify site settings

\- Environment variables

\- Set NEXT\_PUBLIC\_API\_URL to the Render URL

\- Trigger a redeploy



\### Verify



\- Open the Netlify site

\- Log in

\- Expect: the browser network tab shows requests to the Render URL

\- Expect: responses come back, no CORS errors



\---



\# Piece 4 — Production database migration



\## Why it is missing



The audit found:



\- CI migrates a clean Postgres

\- But nothing proves the production database has all 7 migrations applied

\- Migration state of production is UNCLEAR



\## What to build



Option A — Render Postgres (recommended if you used Render for backend):



\- Render offers Postgres free tier

\- Connect backend to it

\- Run migrations once



Option B — Neon (recommended for a hosted DB):



\- Neon free tier Postgres

\- Copy the connection string into backend DATABASE\_URL



Option C — You already have a production Postgres:



\- Confirm the connection string

\- Run migrations against it



Steps:



1\. In the backend, ensure prisma is set up

2\. In backend package.json, confirm scripts:

&#x20;  - `"migrate:deploy": "prisma migrate deploy"`

&#x20;  - `"generate": "prisma generate"`

3\. From Codespaces or your laptop, run:

&#x20;  ```

&#x20;  DATABASE\_URL=<production url> npm run migrate:deploy --workspace=backend

&#x20;  ```

4\. Confirm no errors

5\. Verify with:

&#x20;  ```

&#x20;  DATABASE\_URL=<production url> npx prisma migrate status

&#x20;  ```

&#x20;  Expect: "Database schema is up to date"

6\. Seed initial data if needed:

&#x20;  - Only run seed if this is a brand new database

&#x20;  - Never run seed in production if users exist



\### Verify



\- Open the Netlify site

\- Log in

\- Create a task

\- Refresh

\- The task is still there

\- That proves the database is live and persistent



\---



\# What Phase 3 changes



Backend:



\- New Prisma model: PasswordResetToken

\- New migration for it

\- New endpoints: /api/auth/forgot-password and /api/auth/reset-password

\- New endpoint: /api/attachments (if missing)

\- New env var: email provider key



Frontend:



\- New page: /forgot-password

\- New page: /forgot-password/reset

\- New component: PhotoUpload

\- PhotoUpload integrated into: task detail, daily report form,

&#x20; issue detail, QA inspection, project site photos



Infrastructure:



\- Render account and service

\- Render env vars

\- Netlify env var: NEXT\_PUBLIC\_API\_URL

\- Production database with migrations applied



\# What Phase 3 removes



\- The dead "Forgot password?" link on /login (now points to a real page)

\- The local-dev-only assumption that backend runs on localhost

\- Any reliance on a dev seed in production



\# How to test Phase 3



\## Test password reset



1\. Open /login

2\. Click "Forgot password?"

3\. Enter a real email

4\. Expect: "Check your email"

5\. Open the email

6\. Click the link

7\. Enter a new password

8\. Submit

9\. Expect: redirect to /login

10\. Log in with the new password

11\. Expect: success

12\. Verify the old password no longer works



\## Test photo workflow



1\. Log in

2\. Open a task

3\. Tap "Add photo"

4\. Choose camera on mobile

5\. Take a photo

6\. Expect: upload succeeds, thumbnail appears

7\. Refresh the page

8\. Expect: the photo is still there

9\. Open the same task on desktop

10\. Expect: the photo appears

11\. Delete the photo

12\. Refresh

13\. Expect: it is gone



\## Test backend hosting



1\. Open the Netlify site on a phone

2\. Log in

3\. Open the browser dev tools

4\. Every API call goes to the Render URL, not localhost

5\. No CORS errors

6\. No mixed-content warnings



\## Test production database



1\. Create a task

2\. Create a report

3\. Create an issue

4\. Refresh the browser

5\. All three are still there

6\. Open on a different device

7\. All three are still there

8\. That proves persistence



\# Session execution (on phone or laptop)



Phase 3 is big. Do it in 3 sessions.



\## Session A — Backend hosting and DB migration (1 to 2 hours)



1\. Open Render in a browser

2\. Create the Web Service

3\. Add env vars

4\. Deploy

5\. Confirm the public URL responds

6\. In Netlify, set NEXT\_PUBLIC\_API\_URL

7\. Redeploy the frontend

8\. Test login against the new backend

9\. Run migrations against production DB

10\. Confirm a task persists



\## Session B — Password reset (2 hours)



1\. Open Codespaces

2\. Add PasswordResetToken model to schema.prisma

3\. Create the migration

4\. Add the two backend endpoints

5\. Add email provider integration

6\. Create /forgot-password page

7\. Create /forgot-password/reset page

8\. Commit and push

9\. Test the whole flow on phone



\## Session C — Photo workflow (2 to 3 hours)



1\. Open Codespaces

2\. Confirm POST /api/upload works

3\. Add POST /api/attachments if missing

4\. Create PhotoUpload component

5\. Add it to task detail

6\. Add it to daily report form

7\. Add it to issue detail

8\. Add it to QA inspection

9\. Commit and push

10\. Test the whole flow on phone



\# Do not do in Phase 3



\- Do not redesign any page

\- Do not rewire pages that already work

\- Do not add features not listed here

\- Do not change the design system

\- Do not change the backend beyond the two new endpoints

\- Do not modify the auth flow from Phase 0



Phase 3 is only: the four missing pieces.



\# Done criteria



Phase 3 is done when:



\- A user can request a password reset

\- A user can complete a password reset

\- The reset link expires correctly

\- Photos attach to tasks, reports, and issues

\- Photos persist and are visible across devices

\- The backend runs on a public URL

\- The frontend calls that URL, not localhost

\- Production database has all migrations applied

\- Data persists across refreshes and devices

\- No console errors in production

\- The audit's TOP 10 BLOCKERS list is fully closed



\# How long Phase 3 takes



Roughly 5 to 7 hours of focused work.

Split into 3 sessions as above.



Session A is mostly configuration and waiting for deploys.

Session B is real backend work.

Session C is component work plus integration.



\# How this connects to Phase 4



Phase 4 is the execution loop: worker logs in, checks in, updates tasks,

submits daily report, manager approves.



Phase 4 requires:



\- Real login (Phase 0)

\- Real roles (Phase 1)

\- Real API wiring (Phase 2)

\- Photo workflow (Phase 3)



Without Phase 3, the worker cannot attach a photo to a task.

Without Phase 3, the daily report cannot have evidence.

Without Phase 3, the execution loop is text-only.



Do Phase 3 completely. Then Phase 4.



\# After Phase 3, the audit's TOP 10 BLOCKERS are closed



The audit's TOP 10 BLOCKERS were:



1\. Restore real web authentication → Phase 0

2\. Remove preview identities from AuthContext → Phase 0

3\. Verify production backend hosting → Phase 3

4\. Verify production database migration state → Phase 3

5\. Fix /qa vs /qa-qc route drift → Phase 1

6\. Establish one authoritative authorization contract → Phase 1

7\. Complete construction photo workflow → Phase 3

8\. Implement password recovery → Phase 3

9\. Verify every frontend mutation against real backend APIs → Phase 2

10\. Run a clean end-to-end production acceptance test → Phase 4



Phases 0, 1, 2, and 3 close blockers 1 through 9.

Phase 4 closes blocker 10 by running the acceptance test.

