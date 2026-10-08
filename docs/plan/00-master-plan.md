\# HIIEKO — Master Execution Plan



This folder contains the complete plan to take HIIEKO from its current

state to a production-ready product.



Every phase is one file. Every file is self-contained.

Read this index first. Then read the file for the phase you are working on.



\---



\## How to use this plan



For a human reading it: read in order, top to bottom. Do not skip

phases. Each phase assumes the previous one is done.



For an AI coding agent (OpenCode, Claude Code, Cursor): read this

file, then read the phase file you are assigned. Follow it exactly.

Do not invent work outside the phase. Ask before guessing.



\---



\## The rules for any AI session



1\. One phase per session. Never two.

2\. One branch per phase. Never work on `main`.

3\. Read the phase file completely before writing any code.

4\. Read the referenced audit files before starting.

5\. Work one file at a time.

6\. Commit after every file with a clear message.

7\. Do not touch files the phase file does not mention.

8\. Do not add features the phase file does not mention.

9\. Do not redesign anything.

10\. If the phase file is ambiguous, stop and ask.

11\. Open a PR when the phase is done. Do not merge.

12\. The human tests the Netlify preview before merging.



\---



\## The execution order



Do these in this exact order. Do not parallelize.



\### Track 1 — Design foundation



1\. \*\*01-design-d0-d7.md\*\* — All design phases (D0 through D7)



&#x20;  - D0: Global design tokens

&#x20;  - D1: Login and signup

&#x20;  - D2: Empty states

&#x20;  - D3: Responsive passes

&#x20;  - D4: Migrate Gen 2 pages

&#x20;  - D5: Resolve duplication

&#x20;  - D6: Mobile nav discoverability

&#x20;  - D7: Final polish



\### Track 2 — Functional core



2\. \*\*02-phase0-real-login.md\*\* — Real authentication end to end

3\. \*\*03-phase1-routes-roles.md\*\* — Routes, roles, permissions agree

4\. \*\*04-phase2-wire-apis.md\*\* — Every page reads and writes through the API

5\. \*\*05-phase3-missing-features.md\*\* — Password reset, photos, hosting, DB

6\. \*\*06-phase4-execution-loop.md\*\* — Worker day end to end

7\. \*\*07-phase5-control-tower.md\*\* — Real management dashboard

8\. \*\*08-phase6-hardening.md\*\* — Security, backups, monitoring, performance

9\. \*\*09-phase7-sales.md\*\* — Sales lifecycle and operations handoff



\---



\## Why this order



\- Design first because it is fast, visible, and makes the app look

&#x20; finished while you make it work.



\- Phase 0 first in functional because nothing works without real users.



\- Phase 1 second because pages cannot be wired if navigation lies.



\- Phase 2 third because every page must talk to the real backend.



\- Phase 3 fourth because missing features (photos, password reset,

&#x20; hosting) block the real use case.



\- Phase 4 fifth because that is where you prove the whole system works.



\- Phase 5 sixth because Control Tower needs real data to aggregate.



\- Phase 6 seventh because you harden only after the system works.



\- Phase 7 last because sales is a new surface, not a fix.



\---



\## Reference documents



Read these before starting any phase. They describe the current state

of the codebase as of the last audit.



\- \*\*docs/audits/technical-audit.md\*\*

&#x20; Full audit of backend, database, and frontend structure.

&#x20; Lists every endpoint, every model, every security issue.



\- \*\*docs/audits/design-audit.md\*\*

&#x20; Full UI/UX audit of every page.

&#x20; Lists every missing state, every inconsistency, every gap.



\- \*\*docs/plan/00-master-plan.md\*\* (this file)

&#x20; The index and rules.



\---



\## The current state (as of last audit)



Summarized from the technical audit.



What exists and works:



\- 84 Prisma models, 7 migrations

\- Real JWT auth on backend

\- Role and project access guards

\- 30+ backend modules covering Projects, Tasks, Attendance, Daily Reports,

&#x20; Materials, Inventory, Documents, OCR, Expenses, QA/QC, Issues, Change

&#x20; Orders, Costs, Notifications, Control Tower, Solar configurator

\- Real CI pipeline (typecheck, tests, migrations, build)

\- Structured error handling and logging



What is broken or missing:



\- Web login is bypassed (preview role selector instead of real auth)

\- Preview identities in AuthContext

\- /qa vs /qa-qc route drift

\- Backend production hosting undefined

\- Production database migration state unknown

\- Photo workflow incomplete

\- Password reset missing

\- Many frontend pages use mock data or hand-rolled styles

\- 15 pages have design inconsistency



Every one of these is addressed by exactly one phase in this plan.



\---



\## Progress tracking



Mark phases as done as you complete them. Edit this file, or use a

separate `PROGRESS.md`. Either way, keep it honest.



\- \[ ] 01-design-d0-d7

\- \[ ] 02-phase0-real-login

\- \[ ] 03-phase1-routes-roles

\- \[ ] 04-phase2-wire-apis

\- \[ ] 05-phase3-missing-features

\- \[ ] 06-phase4-execution-loop

\- \[ ] 07-phase5-control-tower

\- \[ ] 08-phase6-hardening

\- \[ ] 09-phase7-sales



When all boxes are checked, HIIEKO is a production product.



\---



\## The prompt to give an AI agent



Use this template at the start of every session. Change only the two

marked lines.



```

You are working on the HIIEKO project at github.com/hiieko/hiieko-System.



READ FIRST (do not skip):

1\. docs/plan/00-master-plan.md

2\. docs/audits/technical-audit.md

3\. docs/audits/design-audit.md

4\. docs/plan/\[PHASE FILE FOR TODAY]



TODAY'S TASK:

Execute \[PHASE NAME] — the file you read above.



RULES:

\- Create a new branch named: \[branch-name]

\- Follow the phase file exactly. Do not add features it does not mention.

\- Work on ONE file at a time.

\- After each file, commit with a message describing what changed.

\- Do not merge to main. Open a PR when done.

\- Do not touch files the phase file does not mention.

\- Do not redesign anything.

\- If something in the phase file is ambiguous, stop and ask me before

&#x20; continuing.



START:

Tell me the plan for this session in 5 bullets. Then wait for my "go".

```



The "5 bullets, then wait" step is critical. Do not let the agent start

coding before it tells you the plan. That single rule prevents most AI

disasters.



\---



\## When a phase is done



1\. Open the PR the agent created.

2\. Read the diff. Understand every change.

3\. Open the Netlify preview URL. Test on your phone.

4\. Run any tests the phase file lists.

5\. If everything passes, merge to main.

6\. Update the progress checkbox above.

7\. Rest. Do not start the next phase in the same session.



\---



\## When a phase goes wrong



1\. Delete the branch. Do not try to fix it.

2\. `git checkout main`

3\. Start the phase over with a smaller scope.

4\. If it fails again, the phase file is too vague. Ask the agent which

&#x20;  part it does not understand.



Do not spend hours fixing a bad AI session. Delete and restart. It is

always faster.



\---



\## When you are stuck



1\. Ask the agent to explain what it is trying to do.

2\. Paste the error into ChatGPT with repo access.

3\. Ask me (Claude) — I have this whole plan in context.

4\. Never ask an AI to "fix the project." Ask about one file, one

&#x20;  function, one error.



\---



\## Definition of done



HIIEKO is done when:



\- A real user logs in with email and password

\- They see their role-specific home

\- They can do their daily work in the app

\- A manager sees everything in the Control Tower

\- Photos, reports, tasks, materials, issues all persist

\- Nothing shows fake data

\- The system is backed up, monitored, and secure

\- Sales flows into operations without re-entering data



That is the target. This plan gets you there.



\---



End of master plan. Now open the phase file for today's work.

