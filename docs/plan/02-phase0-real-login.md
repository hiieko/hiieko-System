\# HIIEKO — Phase 0 Functional

\# Real Login and Auth



Branch: `auth/phase-0-real-login`

Time: 3 to 5 hours (2 sessions)



\## What this phase does



D1 (design) gave you a login screen that LOOKS right.

Phase 0 makes it WORK.



After this phase:



\- A real user logs in with email and password

\- The backend issues a real JWT

\- The frontend stores it and calls /api/auth/me

\- The user lands on their role's home screen

\- Refreshing the page keeps them logged in

\- Logging out actually logs them out

\- The preview role selector is gone forever



\## What this phase is not



Phase 0 is not:



\- A visual redesign. D1 already handled that.

\- Password reset. That is Phase 3.

\- Email verification. That is Phase 3.

\- Social login. Not planned.

\- Backend changes, unless something is broken.



Phase 0 is only: make the existing backend auth work end to end from

the frontend.



\## What already exists



Backend, all confirmed by the audit:



\- POST /api/auth/register — create account

\- POST /api/auth/login — returns JWT access token plus refresh cookie

\- POST /api/auth/refresh — rotates access token

\- GET /api/auth/me — returns current user

\- POST /api/auth/logout — revokes session, clears cookie



Auth mechanics already implemented:



\- JWT with 900 second TTL for web

\- Refresh token in httpOnly cookie named hiieko\_rt

\- Access token stored client-side

\- Session-bound tokens with sid claim

\- Rate limiting on auth routes

\- Global ValidationPipe on all requests



Frontend pieces that exist:



\- `web/src/lib/api-client.ts` — has login(), logout(), refresh(),

&#x20; setToken(), getToken()

\- Access token key: `api\_token` in localStorage

\- Refresh uses `credentials: 'include'`

\- `web/src/contexts/AuthContext.tsx` — has real user state, but is

&#x20; currently bypassed by preview identities



So the architecture is complete. What is broken is only the wiring:

the login page and AuthContext.



The two things to fix:



1\. `web/src/app/login/page.tsx` — remove preview selection, call real login

2\. `web/src/contexts/AuthContext.tsx` — remove preview identities, use

&#x20;  real /api/auth/me on boot



\## The preview system to remove



From `web/src/app/login/page.tsx`:



\- The role cards grid

\- The preview warning banner

\- The "Login is temporarily disabled" text

\- Any write to `sessionStorage\['hiieko\_role\_preview']`



From `web/src/contexts/AuthContext.tsx`:



\- The hardcoded preview identities:

&#x20; preview-admin, preview-owner, preview-manager, preview-site-manager,

&#x20; preview-foreman, preview-team-leader, preview-worker, and any others

\- The code that reads `sessionStorage\['hiieko\_role\_preview']`

\- The code that manufactures a user from that value

\- The code that calls `apiClient.setToken(null)` when a preview user is

&#x20; present

\- Any comment that says "temporary preview" or "design only"



Also search the whole `web/src` folder for `preview` and remove every hit

that is related to auth. Keep any unrelated usages (e.g. image preview

in a file upload).



\## The real login flow



Here is what happens when a user submits the login form.



Step 1 — Client validates input



\- Email format check

\- Password min length check

\- If invalid, show field errors and stop



Step 2 — Client calls the API



Call `apiClient.login(email, password)`.

This hits `POST /api/auth/login`.

The request sends `credentials: 'include'` so the refresh cookie is set.



Step 3 — Backend validates



\- Looks up user by email

\- Verifies password hash

\- Checks user is\_active and status

\- Creates a Session row

\- Issues JWT with sid claim

\- Returns access token plus sets hiieko\_rt cookie



Step 4 — Client stores the token



\- apiClient stores the access token under `api\_token` in localStorage

\- No other storage needed. Refresh cookie is handled by the browser.



Step 5 — Client loads the user



\- Call `GET /api/auth/me` with the Bearer token

\- Receive the full user object: id, email, role, name, org, permissions



Step 6 — Client stores user in context



\- AuthContext sets user state

\- Any component reading `useAuth()` now sees the real user



Step 7 — Client redirects



Redirect to role home:



\- worker, team leader, foreman → /planning

\- site manager, project manager, manager, owner → /control-tower

\- QA/QC → /qa

\- finance → /cheltuieli

\- admin → /utilizatori

\- viewer → /projects



Step 8 — Toast



\- Optional: "Welcome back, \[first name]" on success

\- Do not show this if the user just signed up



\## The real signup flow



Step 1 — Client validates input



\- First name required

\- Last name required

\- Email format

\- Password min length

\- Confirm password matches

\- Terms accepted



Step 2 — Client calls the API



Call `apiClient.register` with the form fields.

This hits `POST /api/auth/register`.



Step 3 — Backend creates the user



\- Creates User plus UserProfile

\- Assigns default role (usually Worker or a pending role)

\- Does not auto-login. The user must sign in.



Step 4 — Client shows success



\- Toast: "Account created. Sign in to continue."

\- Redirect to /login

\- Pre-fill the email field if possible



\## The boot flow (page refresh)



This is the most important part. Every time the app loads, AuthContext

must answer: "Is this user logged in?"



Correct boot sequence:



Step 1 — AuthContext mounts



\- Initial state: user = null, loading = true



Step 2 — Check for an access token



\- `apiClient.getToken()` returns the token from localStorage or null



Step 3a — If no token



\- Set loading = false, user = null

\- App renders the login page for unauthenticated routes



Step 3b — If token exists



\- Call `GET /api/auth/me`

\- If it returns a user, set user = result, loading = false

\- If it returns 401:

&#x20; - Call `apiClient.refresh()`

&#x20; - If refresh succeeds, retry `GET /api/auth/me`

&#x20; - If refresh fails, clear token, set user = null, loading = false,

&#x20;   redirect to /login

\- If it returns any other error, clear token, set user = null, loading = false



Step 4 — Render



\- If loading, show a full-page skeleton or spinner

\- If user is null, show login

\- If user exists, show the app



\## Protected routes



Right now, unauthenticated users can probably load some pages directly.

Fix with one wrapper component.



Create or confirm a component called `ProtectedRoute`:



\- Reads `useAuth()` for user and loading

\- If loading, shows a skeleton

\- If no user, redirects to /login with a redirect param:

&#x20; `/login?from=/the-original-path`

\- If user exists, renders children



After login succeeds, if a `from` param exists, redirect to it.

Otherwise, redirect to role home.



Apply `ProtectedRoute` to:



\- Every page under `web/src/app` EXCEPT /login and /signup



Do not apply it to:



\- /login

\- /signup

\- Any public marketing page, if one exists



The cleanest way to apply it: wrap the root layout or create a route

group in the App Router. One wrapper around the whole authenticated

area, not one per page.



\## Logout



The logout button must:



1\. Call `POST /api/auth/logout` (revokes session, clears cookie)

2\. Call `apiClient.setToken(null)` to clear the access token

3\. Set user = null in AuthContext

4\. Redirect to /login

5\. Show toast "Signed out"



Where the logout button lives:



\- The user menu in the Header (desktop)

\- The same user menu in the mobile drawer

\- Possibly on /profil



All three must call the same logout handler from AuthContext.



\## Token refresh (invisible to user)



Access tokens expire in 900 seconds (15 minutes). The refresh cookie

lasts longer.



The api-client must handle this automatically:



\- Every API request that returns 401 with a valid refresh cookie

&#x20; triggers a refresh

\- The refresh calls `POST /api/auth/refresh`

\- On success, the new token is stored and the original request retried

\- On failure, the user is redirected to /login



The audit confirms `api-client.ts` already has refresh logic around

line 414. Verify it:



\- Does it retry the original request after refresh?

\- Does it handle refresh failure cleanly?

\- Does it avoid infinite loops (401 on refresh itself does not trigger

&#x20; another refresh)?



If any of those is missing, add it. This is the single most fragile part

of the auth system, so test it explicitly:



Test: log in, wait 16 minutes, click something. The app should refresh

silently and the user should not notice.



\## What Phase 0 changes



Files to edit:



1\. `web/src/app/login/page.tsx`

&#x20;  - Remove preview UI, add real submit handler



2\. `web/src/app/signup/page.tsx`

&#x20;  - Add real submit handler if not present



3\. `web/src/contexts/AuthContext.tsx`

&#x20;  - Remove preview identities

&#x20;  - Add real boot sequence

&#x20;  - Add real logout



4\. `web/src/lib/api-client.ts`

&#x20;  - Verify refresh logic. Add if missing.



5\. `web/src/components/ProtectedRoute.tsx` (new or existing)

&#x20;  - Create if missing



6\. `web/src/app/layout.tsx` (or route group layout)

&#x20;  - Wrap authenticated area in ProtectedRoute



7\. Any component with a logout button

&#x20;  - Wire to the shared logout handler



Files NOT to edit in Phase 0:



\- Any backend file

\- Any page except login, signup, layout

\- Any design or styling file



\## How to test Phase 0



Test every item below. Do not skip.



Test 1 — Real login



\- Open /login

\- Enter a real seeded user email and password

\- Submit

\- Expect: redirect to role home, user menu shows real name



Test 2 — Wrong password



\- Enter a real email with a wrong password

\- Submit

\- Expect: toast "Wrong email or password", password field cleared

\- Expect: no token stored, still on /login



Test 3 — Unknown email



\- Enter an email that does not exist

\- Submit

\- Expect: same generic message as wrong password. Do not reveal whether

&#x20; the email exists.



Test 4 — Rate limiting



\- Submit wrong password 6 times quickly

\- Expect: toast "Too many attempts. Wait a minute."

\- Expect: further attempts blocked for 60 seconds



Test 5 — Refresh persistence



\- Log in successfully

\- Refresh the browser

\- Expect: still logged in, still on the same page

\- Expect: no flash of the login screen



Test 6 — Expired token



\- Log in successfully

\- Manually delete the `api\_token` from localStorage via browser dev tools

\- Refresh the page

\- Expect: app attempts /api/auth/me, gets 401, tries refresh

\- Expect: if refresh cookie is valid, user is logged back in silently

\- Expect: if refresh cookie is gone, redirect to /login



Test 7 — Logout



\- Log in successfully

\- Click logout

\- Expect: toast "Signed out"

\- Expect: redirected to /login

\- Expect: api\_token removed from localStorage

\- Expect: pressing back does not return to the authenticated page



Test 8 — Protected route



\- Log out

\- Try to open /tasks directly by URL

\- Expect: redirected to /login?from=/tasks

\- Log in

\- Expect: redirected back to /tasks



Test 9 — Signup



\- Open /signup

\- Fill the form with a new email

\- Submit

\- Expect: toast "Account created. Sign in to continue."

\- Expect: redirected to /login with email pre-filled



Test 10 — Signup with existing email



\- Open /signup

\- Use an email that already exists

\- Submit

\- Expect: field-level error under email "This email is already registered"



Test 11 — Role-based landing



\- Log in as a worker. Expect: /planning

\- Log out. Log in as a site manager. Expect: /control-tower

\- Log out. Log in as QA. Expect: /qa

\- Log out. Log in as admin. Expect: /utilizatori



Test 12 — Mobile



\- Do all of the above on a phone at 375px

\- Expect: same behavior, no layout break



\## What Phase 0 removes



\- sessionStorage key: `hiieko\_role\_preview`

\- All preview-admin, preview-owner, preview-worker, etc. identities

\- Any comment that says "temporary preview mode"

\- Any "Login is temporarily disabled" text

\- Any code path that sets a fake user without hitting the backend



\## What Phase 0 adds



\- Real submit handler on /login

\- Real submit handler on /signup

\- Real boot sequence in AuthContext

\- Real logout handler

\- ProtectedRoute wrapper on the authenticated area

\- Verified token refresh in api-client

\- Role-based redirect after login



\## How long Phase 0 takes



Roughly 3 to 5 hours of focused work.

Split into two sessions.



Session A (2 to 3 hours):



\- Remove preview system

\- Wire login submit

\- Wire signup submit

\- Test 1, 2, 3, 4



Session B (1 to 2 hours):



\- Add boot sequence

\- Add ProtectedRoute

\- Verify refresh

\- Wire logout

\- Test 5, 6, 7, 8, 9, 10, 11, 12



\## Session execution (on phone)



Setup:



1\. Open Codespaces or OpenCode

2\. Create branch: `auth/phase-0-real-login`

3\. Open `web/src/contexts/AuthContext.tsx` first, read the whole file



Order:



1\. In AuthContext, remove the preview identity block

2\. In AuthContext, add the boot sequence: read token, call /api/auth/me,

&#x20;  set user

3\. In AuthContext, add the real logout handler

4\. Commit and push. Do not test yet — the login page still writes to

&#x20;  sessionStorage.

5\. Open `web/src/app/login/page.tsx`

6\. Remove the role cards, warning banner, and preview write

7\. Add the submit handler calling apiClient.login

8\. Add the on-success flow: set user, redirect by role

9\. Commit and push

10\. Open Netlify preview on phone

11\. Test 1 through 4

12\. Fix what breaks, commit, retest

13\. Do the same for /signup

14\. Add ProtectedRoute

15\. Verify refresh in api-client

16\. Test 5 through 12

17\. Open PR

18\. Test on preview

19\. Merge to main



\## Do not do in Phase 0



\- Do not redesign the login screen. D1 handled that.

\- Do not add password reset. That is Phase 3.

\- Do not add email verification. That is Phase 3.

\- Do not change any backend file unless a specific bug is proven.

\- Do not touch any other page.

\- Do not add new routes.



Phase 0 is only: real auth, end to end.



\## Done criteria



Phase 0 is done when:



\- Real users can log in with email and password

\- The preview role selector is gone

\- No preview identity exists anywhere in `web/src`

\- Refreshing the page keeps the user logged in

\- Expired tokens refresh silently

\- Logout clears everything and redirects to /login

\- Unauthenticated users are redirected from protected routes

\- After login, users land on the correct role home

\- Signup creates a real account

\- All 12 tests pass on desktop and mobile

\- No console errors during any of the above



When Phase 0 is done, HIIEKO has a real user system. That is the

foundation everything else sits on.



\## How this connects to the master plan



Phase 0 is the first functional phase. It unlocks everything after it:



\- Phase 1 (route and role alignment) needs a real user with a real role

\- Phase 2 (wire pages to real APIs) needs a real JWT on every request

\- Phase 3 (missing features) needs a real user session

\- Phase 4 (execution loop) needs a logged-in worker

\- Phase 5 (Control Tower) needs a logged-in manager

\- Phase 6 (hardening) audits the auth you just built

\- Phase 7 (sales) needs authenticated sales users



Nothing else works until Phase 0 works. That is why it is first.

