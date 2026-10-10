# HIIEKO — Master Execution Plan

This folder contains the complete plan to take HIIEKO from its current
state to a production-ready product.

Every phase is one file. Every file is self-contained.
Read this index first. Then read the file for the phase you are working on.

---

## How to use this plan

For a human reading it: read in order, top to bottom. Do not skip
phases. Each phase assumes the previous one is done.

For an AI coding agent (OpenCode, Claude Code, Cursor): read this file,
then read the phase file you are assigned. Follow it exactly. Do not
invent work outside the phase. Ask before guessing.

---

## The rules for any AI session

1. One phase per session. Never two.
2. Work directly on master. No feature branch. No PR.
3. Read the phase file completely before writing any code.
4. Read the referenced audit files before starting.
5. Work one file at a time.
6. Commit after every file with a clear message.
7. Do not touch files the phase file does not mention.
8. Do not add features the phase file does not mention.
9. Do not redesign anything.
10. If the phase file is ambiguous, stop and ask.
11. Run `npm run build --workspace=web` before each commit.
12. Push master at the end of the session.

---

## The execution order

Do these in this exact order. Do not parallelize.

### Track 1 — Design foundation (done)

1. **01-design-d0-d7.md** — All design phases (D0 through D7)

   - D0: Global design tokens
   - D1: Login and signup
   - D2: Empty states
   - D3: Responsive passes
   - D4: Migrate Gen 2 pages
   - D5: Resolve duplication
   - D6: Mobile nav discoverability
   - D7: Final polish

### Track 2 — Functional core

2. **02-phase0-real-login.md** — Real authentication end to end
3. **14-phase0-5-security.md** — Security Priority 1 (rate limit, secrets, headers)
4. **03-phase1-routes-roles.md** — Routes, roles, permissions agree
5. **04-phase2-wire-apis.md** — Every page reads and writes through the API
6. **05-phase3-missing-features.md** — Password reset, photos, hosting, DB
7. **06-phase4-execution-loop.md** — Worker day end to end
8. **07-phase5-control-tower.md** — Real management dashboard
9. **08-phase6-hardening.md** — Security, backups, monitoring, performance (includes RLS)
10. **09-phase7-sales.md** — Sales lifecycle and operations handoff

### Track 3 — Deferred

11. **13-d8-redesign.md** — Redesign pass (after Phase 3)
12. D9 — Dark mode (separate, optional, later)

---

## Why this order

- Design first because it is fast, visible, and makes the app look
  finished while you make it work.

- Phase 0 first in functional because nothing works without real users.

- Phase 0.5 second because real users means real attacks. Rate limiting,
  secrets, and headers must be in place before anyone logs in who is
  not you.

- Phase 1 third because pages cannot be wired if navigation lies.

- Phase 2 fourth because every page must talk to the real backend.

- Phase 3 fifth because missing features (photos, password reset,
  hosting) block the real use case.

- Phase 4 sixth because that is where you prove the whole system works.

- Phase 5 seventh because Control Tower needs real data to aggregate.

- Phase 6 eighth because you harden only after the system works.

- Phase 7 last because sales is a new surface, not a fix.

---

## Reference documents

Read these before starting any phase. They describe the current state
of the codebase as of the last audit.

- **docs/audits/technical-audit.md**
  Full audit of backend, database, and frontend structure.
  Lists every endpoint, every model, every security issue.

- **docs/audits/design-audit.md**
  Full UI/UX audit of every page.
  Lists every missing state, every inconsistency, every gap.

- **docs/plan/00-master-plan.md** (this file)
  The index and rules.

---

## The current state (as of last audit)

Summarized from the technical audit.

What exists and works:

- 84 Prisma models, 7 migrations
- Real JWT auth on backend
- Role and project access guards
- 30+ backend modules covering Projects, Tasks, Attendance, Daily Reports,
  Materials, Inventory, Documents, OCR, Expenses, QA/QC, Issues, Change
  Orders, Costs, Notifications, Control Tower, Solar configurator
- Real CI pipeline (typecheck, tests, migrations, build)
- Structured error handling and logging

What is broken or missing:

- Web login is bypassed (preview role selector instead of real auth)
- Preview identities in AuthContext
- /qa vs /qa-qc route drift
- Backend production hosting undefined
- Production database migration state unknown
- Photo workflow incomplete
- Password reset missing
- Many frontend pages use mock data or hand-rolled styles
- 15 pages have design inconsistency

Every one of these is addressed by exactly one phase in this plan.

---

## Progress tracking

Mark phases as done as you complete them. Edit this file, or use a
separate PROGRESS.md. Either way, keep it honest.

- [x] 01-design-d0-d7
- [ ] 02-phase0-real-login
- [ ] 14-phase0-5-security
- [ ] 03-phase1-routes-roles
- [ ] 04-phase2-wire-apis
- [ ] 05-phase3-missing-features
- [ ] 06-phase4-execution-loop
- [ ] 07-phase5-control-tower
- [ ] 08-phase6-hardening
- [ ] 09-phase7-sales
- [ ] 13-d8-redesign

When all boxes are checked, HIIEKO is a production product.

---

## The prompt to give an AI agent

Use this template at the start of every session. Change only the two
marked lines.

```
You are working on the HIIEKO project at github.com/hiieko/hiieko-System.

READ FIRST (do not skip):
1. docs/plan/00-master-plan.md
2. docs/audits/technical-audit.md
3. docs/audits/design-audit.md
4. docs/plan/[PHASE FILE FOR TODAY]

TODAY'S TASK:
Execute [PHASE NAME] — the file you read above.

RULES:
- Work directly on master. No branch. No PR.
- Follow the phase file exactly. Do not add features it does not mention.
- Work on ONE file at a time.
- After each file, commit with a message describing what changed.
- Run npm run build --workspace=web before each commit.
- Do not touch files the phase file does not mention.
- Do not redesign anything.
- If something in the phase file is ambiguous, stop and ask me before
  continuing.
- Push master at the end of the session.

START:
Tell me the plan for this session in 5 bullets. Then wait for my "go".
```

The "5 bullets, then wait" step is critical. Do not let the agent start
coding before it tells you the plan. That single rule prevents most AI
disasters.

---

## When a phase is done

1. Check the diff on the last commit.
2. Read the changes. Understand every one.
3. Open the Netlify preview URL (updated automatically from master).
4. Test on your phone.
5. If everything passes, nothing to merge. Master is already updated.
6. Update the progress checkbox above.
7. Rest. Do not start the next phase in the same session.

---

## When a phase goes wrong

1. `git reset --hard HEAD~N` (N = number of bad commits).
   Do not try to fix a bad commit forward.
2. Confirm master is clean with `git status`.
3. Start the phase over with a smaller scope.
4. If it fails again, the phase file is too vague. Ask the agent which
   part it does not understand.

Do not spend hours fixing a bad AI session. Reset and restart. It is
always faster.

---

## When you are stuck

1. Ask the agent to explain what it is trying to do.
2. Paste the error into ChatGPT with repo access.
3. Ask me (Claude) — I have this whole plan in context.
4. Never ask an AI to "fix the project." Ask about one file, one
   function, one error.

---

## Definition of done

HIIEKO is done when:

- A real user logs in with email and password
- They see their role-specific home
- They can do their daily work in the app
- A manager sees everything in the Control Tower
- Photos, reports, tasks, materials, issues all persist
- Nothing shows fake data
- The system is backed up, monitored, and secure
- Sales flows into operations without re-entering data

That is the target. This plan gets you there.

---

End of master plan. Now open the phase file for today's work.