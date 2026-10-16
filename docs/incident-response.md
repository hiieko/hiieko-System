# HIIEKO — Incident Response

What to do when something goes wrong in production. Keep it calm, keep it short,
write down timestamps. Related: `docs/runbook.md` (normal operations),
`docs/restore.md` (data loss), `docs/deploy.md` (the hosting setup).

---

## 1. Contact list

| Role | Name | How to reach |
| --- | --- | --- |
| Incident lead (declares, coordinates) | TODO — placeholder name | TODO — phone / email |
| Backend on-call (restarts, rolls back) | TODO — placeholder name | TODO — phone / email |
| Database / hosting admin (restores, provider tickets) | TODO — placeholder name | TODO — phone / email |
| Security & legal (GDPR, breach decisions) | TODO — placeholder name | TODO — phone / email |
| Hosting provider support (Render) | via the provider dashboard | TODO — confirm support tier |

Fill these in before you need them. Do not invent names in an emergency.

---

## 2. First 15 minutes

**Confirm it is real.** Ask: do users report errors, or is it just us?

1. Hit the health endpoints: `GET /health/live` (is the process up?) and
   `GET /health/ready` (does the database answer?). One `503` tells you where the
   problem sits: `/health/ready` failing while `/health/live` passes means the database
   side, not the process.
2. Check the hosting dashboards: is the backend service running, memory/CPU normal,
   database connections not maxed out?
3. Check the last deploy: did this start right after a push? (Hosting dashboard shows
   deploy history.)
4. Check with one real user whether it affects everyone or one account/project.

**Stop the bleeding.**

- Suspect the last change: **roll back to the previous deploy** on the hosting platform
  (or redeploy the last known-good commit). Rolling back is almost always safe and fast.
- One bad account: revoke its sessions (section 4).
- Abusive traffic: the app already rate-limits (section 3, DDoS); escalate to the host.
- **Do not delete or "fix" data while unsure.** Snapshot logs first (section 3, leak).

**Declare.** The incident lead states "we are in an incident", starts a written log
(timestamps, who did what) — **TODO — confirm** where this log is kept (chat channel /
document). Until proven otherwise, treat user-reported data loss as real.

---

## 3. Common incidents and responses

| Incident | First response |
| --- | --- |
| **Backend down** | Restart the service on the hosting platform (see `docs/runbook.md` §2). Watch `/health/live`, then `/health/ready`. If it crashes again immediately, roll back the last deploy — the new build is the suspect. |
| **Database unreachable** | `/health/ready` returns `503`. Check the database provider's dashboard/status page, confirm `DATABASE_URL` is unchanged and the instance is running, and check the connection count. Do not restart the app in a loop — it cannot fix a stopped database. |
| **Suspected account compromise** | Revoke all sessions for that user (section 4), then ask them to change their password. Check the audit trail for logins, `SESSION_REVOKED` and role/status changes around the window. |
| **Suspected data leak** | Snapshot/export logs immediately and preserve them. **Do not modify the database** (evidence). Contact security/legal (section 1) the same day, and start the GDPR clock (section 7). |
| **DDoS / abusive traffic** | Rate limiting is already on globally: 30 writes/min and 100 reads/min per user or IP, with stricter limits on login, register and uploads. For anything bigger, contact the hosting provider for edge protection — **TODO — confirm with the hosting provider** (WAF / edge rate-limit options) — and scale up (`docs/runbook.md` §7). |

---

## 4. How to revoke all sessions for a user

Use the API — the codebase has first-class support for this:

- **Admin, for someone else:** `PATCH /api/users/:id/status` with body
  `{"status": "SUSPENDED"}`. Suspending a user revokes **every** active session of that
  user and writes an audit entry (`SESSION_REVOKED`, reason `SUSPENDED`).
  Requires `ADMIN` or `OWNER`. You cannot change your **own** status — another
  `ADMIN`/`OWNER` must do it.
- **Changing a user's role** (`PATCH /api/users/:id/role`) also revokes all of their
  sessions, so a role change is a second way to force a global sign-out.
- **The user themselves:** `POST /api/auth/change-password` (needs their current
  password) revokes all *other* sessions. `POST /api/auth/logout` revokes only the
  current session.
- **Last resort if the API is unavailable:** set `revoked_at` to now for that user's
  rows in the `sessions` table — sessions are checked against the database on every
  request, so this takes effect immediately. Requires direct database access;
  **TODO — confirm** who holds break-glass production DB credentials.

---

## 5. How to rotate `JWT_SECRET`

1. **Generate** a new long random secret (any secure random generator; long — the
   backend refuses to start in production if the secret is missing, a placeholder,
   or too short).
2. **Update the environment variable** `JWT_SECRET` on the backend service in the
   hosting dashboard (values live there, never in the repository).
3. **Restart / redeploy the backend** — environment variables only take effect on start.
4. **Expect everyone to be signed out.** All access and refresh tokens issued under the
   old secret become invalid; users simply log in again. Announce it so nobody reports
   an "outage".

---

## 6. How to restore from backup

If data was deleted or corrupted, follow **`docs/restore.md`** — it covers both the
database and the uploaded files, plus how to verify the restore. Confirm the loss is
real (section 2) before touching production.

---

## 7. If personal data was involved (GDPR)

- **Authority:** notify **ANSPDCP** (Romanian data authority, Autoritatea Națională de
  Supraveghere a Prelucrării Datelor cu Caracter Personal).
- **Deadline:** within **72 hours** of becoming aware of the breach (if it is not
  likely to result in a risk to people, document why no notification is needed —
  don't just skip it). Notify affected users too when the risk is high.
- Decide with legal/contact person (section 1): what data, how many people, what risk.
- **Email template for affected users (placeholder):**

  > **Subject:** Important notice about your HIIEKO account
  >
  > Hello [name],
  >
  > On [date] we detected [brief, plain description of what happened]. The information
  > involved was [types of data — no more detail than is true]. We have since
  > [actions taken: sessions revoked, secret rotated, restore performed, provider engaged].
  >
  > What you should do: [reset your password / watch for suspicious messages].
  >
  > If you have questions, contact us at [contact]. You may also lodge a complaint with
  > the Romanian data protection authority, ANSPDCP (www.dataprotection.ro).
  >
  > The HIIEKO team

Keep the first version factual — no speculation, no blame, no legal conclusions.

---

## 8. After the incident

- **Write a short post-mortem** (within a week): timeline, user impact, root cause,
  what went well, what did not. **TODO — confirm** where these are filed
  (candidate: `docs/security/`).
- **List what to fix**, with an owner and a date for each item — unowned action items
  are how the same incident happens twice.
- Update this document if reality differed from it (missing contact, wrong dashboard
  name, a faster rollback path you found under pressure).
