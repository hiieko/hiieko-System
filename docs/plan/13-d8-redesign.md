# HIIEKO — D8 Redesign Pass

## When to run it

After Phase 3 (missing features) is done.
Before Phase 4 (execution loop).
One session per sub-phase. Six sub-phases total. About 6 sessions of work.

## What D8 is

D8 turns the app from "functionally correct" into "feels like HIIEKO."

D0–D7 built a consistent design system. D8 uses it to express identity,
hierarchy, and clarity.

D8 is NOT a rewrite. Every page already uses Button, Card, Badge,
PageHeader. D8 rearranges them, colors them, and adds the layers that
were missing.

## What D8 is not

- Not new features
- Not backend changes
- Not layout rewrites (only rearranging existing elements)
- Not new components beyond a small handful
- Not dark mode (that is D9)

## The design language

D8 is built from one reference: the Worker Dashboard Figma. Everything
that follows comes from that.

### Colors

| Role | Light value | Use |
|---|---|---|
| Page background | #F3F4F6 | Behind every page |
| Surface (card) | #FFFFFF | Cards, panels, modals |
| Surface muted | #F3F4F6 | Zebra rows, inner boxes |
| Border | #E5E7EB | Card borders, dividers |
| Text primary | #111827 | Titles, numbers |
| Text secondary | #4B5563 | Meta, subtitles |
| Text muted | #9CA3AF | Timestamps, captions |
| Brand (sidebar) | #111827 | Sidebar background |
| Brand accent | #F59E0B | Active nav, brand mark, hover |
| Success | #10B981 | Completed, check-in, positive |
| Warning | #F59E0B | In progress, pending |
| Danger | #EF4444 | Blocked, overdue, error |
| Info | #3B82F6 | Informational, neutral actions |

These are already roughly in tailwind.config.js. D8.0 aligns them
precisely.

### Typography

One font: Inter (fallback IBM Plex Sans). Sizes:

- 28px — Page title (bold)
- 20px — Section title
- 15px — Card / task title (bold)
- 14px — Body, nav labels (600)
- 13px — Small body, meta with icon
- 12px — Meta, labels, table headers (uppercase, tracked)
- 11px — Badges, timestamps
- 10px — Pill labels (uppercase)

Stop using anything else. No text-lg, no text-base, no arbitrary
text-[Npx].

### Spacing

- 4px grid
- Card padding: 16px
- Page padding: 32px desktop, 16px mobile
- Between cards: 24px
- Between sections: 32px
- Inside cards: 12–16px

### Radius

- Cards, panels: rounded-xl (12px)
- Badges, small buttons: rounded-md (6px)
- Buttons: rounded-lg (8px)
- Avatars: full

### Elevation

Three levels only:

1. Page background — no shadow, grey
2. Card — 1px border, no shadow (or subtle shadow)
3. Modal / drawer — strong shadow + dark scrim behind

That is it. No elevation on cards within cards. No shadows on badges.

### The status color bar

The signature element from the Figma. Every task row, alert row, or
status-tracking item has a 6px-wide colored bar on the left edge:

- Amber → in progress
- Red → blocked
- Grey → scheduled / not started
- Green → completed

This is not a badge. It is a full-height strip on the left of the row.
It tells status at a glance.

Implement once as <StatusBar status="in_progress" />. Use everywhere.

## The sub-phases

### D8.0 — Foundation fixes

Why: D0–D7 missed surface elevation and native control styling.
Without these, the app looks flat no matter what else you do.

Time: 2 sessions

Work:

1. Add three surface levels:
   - Page background → bg-slate-50 (#F3F4F6)
   - Cards stay white
   - Modals: dark scrim (bg-black/50 backdrop-blur-sm) behind them

2. Style native controls in globals.css:
   - input[type="date"] — remove browser chrome, use .hii-input
   - input[type="file"] — hide default, use button + filename display
   - select — remove browser arrow, add custom
   - scrollbar — thin, subtle

3. Fix the warning token:
   - text-warning on light surfaces uses #92400e (dark amber), not
     #F59E0B
   - bg-warning-soft stays #FEF3C7
   - Text on amber backgrounds is always #78350f or #92400e

4. Add zebra striping to all tables:
   - Odd rows: white
   - Even rows: bg-slate-50
   - Hover: bg-slate-100

Commits: 4 (one per item)

Verify: Open every page. Modals float. Date pickers are styled. Tables
are readable. No flat white-on-white.

---

### D8.1 — Sidebar and shell

Why: The sidebar is the identity. It is dark navy in the Figma. This
single change transforms the app.

Time: 1 session

Work:

1. Sidebar background → #111827
2. Active nav item → bg-amber-500 with dark text (#111827)
3. Inactive nav item → transparent, text-gray-400 text, amber on hover
4. Brand mark → amber rounded square with sun icon, "HIIEKO" bold
   white, "Site Management System" small amber
5. User block at bottom → avatar circle with amber bg, name white,
   role grey
6. Nav groups → small uppercase label above each group (OPERATIONS,
   PERSONAL), muted grey
7. Mobile: bottom nav stays light for contrast with outdoor use

Commits: 1

Verify: The app suddenly looks like a product. Sidebar is no longer
generic.

---

### D8.2 — Task card redesign

Why: Tasks are the most-used page. Currently every task looks the
same. This is the single most impactful page redesign.

Time: 1 session

Work:

Rewrite TaskCard (already exists) to match the Figma:

- Left StatusBar (6px, colored per status)
- Checkbox on the left (28×28, custom)
- Task title (15px, bold, #111827)
- Status badge (small, colored, 4px radius)
- Meta row: zone icon + name, clock icon + time
- Optional: details box (grey or red background depending on status)
  for blocked/progress info
- Optional: action pill on the right (FOTO camera icon if photo
  needed)

Remove the current hand-rolled list row. Replace with the new card.

Commits: 1

Verify: Open /tasks. Every task is distinguishable at a glance.
Blocked tasks have red bars. Done tasks are greyed. Status badges are
readable.

---

### D8.3 — Alerts page

Why: The alerts page is unreadable. Gold text on light grey. Full white
table with no separation.

Time: 1 session

Work:

Rewrite the alerts page (/issues or wherever "Alerte Operaționale"
lives — probably / or /control-tower):

- Header with count badge in amber
- Filter chips (All / High / Medium)
- Table:
  - Column headers: 12px uppercase, text-slate-500, bg-slate-50 sticky
  - Rows: 16px padding, zebra
  - Severity: colored left StatusBar (6px)
  - Entity: bold #111827, secondary line for reason
  - Reason: text-slate-600, break words
  - Responsible: avatar (24px) + name
  - Date/Time: 12px, text-slate-500
  - Source: small badge (AttendanceRecord / Task)
  - Action: "Details" button, ghost, arrow icon
- No gold text anywhere. Warning = dark amber on soft amber background.

Commits: 1

Verify: Open the alerts page. Every row readable. Severity obvious. No
contrast problems.

---

### D8.4 — Documents page

Why: It has no categorization, no previews, no icons worth looking at.

Time: 1 session

Work:

Rewrite /documente to match the OpenConstructionERP pattern:

- Left panel (240px): storage usage card, categories list with count
  + size, saved views, recycle bin
- Main area:
  - Header with search, filters, upload button
  - Category cards row (Document / Photo / BIM model / DWG drawing)
    with icons, count, size, percentage bar
  - File list: file icon, name bold, meta line (type · version ·
    size · date), download button
- Add /documente to the sidebar under a "Documents" entry
- Native file input styled (from D8.0)

Commits: 1

Verify: Open /documente. Files are categorized. Downloads work. It
looks like a file manager, not a form.

---

### D8.5 — Dashboard / Control Tower metric cards

Why: The control tower needs hierarchy. Right now everything is a
number in a box.

Time: 1 session

Work:

Redesign the metric row on / and /control-tower:

- Each metric card:
  - Colored left border (4px) per metric type
  - Small uppercase label (TASKS, OPEN, OVERDUE, COMPLETED) in
    text-slate-500
  - Large number (32px bold)
  - Optional trend indicator (up/down arrow)
  - No background color inside the card (white with border)

- Add a chart panel below metrics:
  - Donut for status breakdown
  - Bar chart for priority or type
  - Use Recharts or Chart.js (~50KB)

- Add "Insights" collapsible panel — same pattern as
  OpenConstructionERP

Commits: 1

Verify: Open /. Metrics have hierarchy. Charts show real data. You
understand the state of the business in 3 seconds.

---

## The components to add in D8

Only five new components. Everything else reuses existing.

1. StatusBar — 6px colored strip. Props: status (in_progress /
   blocked / scheduled / done).
2. StatusBadge — small pill. Reuses Badge with new sizes.
3. MetricCard — label + big number + trend + colored left border.
4. ChartPanel — wrapper for donut/bar charts (uses Recharts).
5. Scrim — dark overlay behind modals. Extends Modal.

That is it. Do not add components beyond these unless a page cannot be
built without them.

---

## The order to execute

Do these in order. Do not skip. Do not reorder.

1. D8.0 — Foundation fixes (2 sessions)
2. D8.1 — Sidebar and shell (1 session)
3. D8.2 — Task card (1 session)
4. D8.3 — Alerts page (1 session)
5. D8.4 — Documents page (1 session)
6. D8.5 — Metrics and charts (1 session)

Then stop. Do not continue to D9.

---

## How to execute each sub-phase with OpenCode

Same pattern as D0–D7. Nothing new.

Setup prompt:

```
Read docs/plan/13-d8-redesign.md.
Read the section for [D8.X].
Also read the Figma reference: docs/design/d8-worker-dashboard-reference.css.

TODAY'S TASK:
Execute [D8.X] only.

RULES:
- Work on master. No branch.
- One commit per logical change.
- Build before each commit.
- Push at the end.
- Follow the design language in the section exactly.
- Do not redesign pages outside the current sub-phase.
- Do not add new colors, sizes, or shadows beyond what is listed.
- If something in the spec is ambiguous, stop and ask.
- If a shared component lacks a slot you need, stop and ask.

START:
Tell me the plan in 5 bullets. Wait for my "go".
```

---

## What NOT to do in D8

- Do not introduce dark mode (D9)
- Do not add new pages
- Do not change backend or API calls
- Do not change routes or navigation structure
- Do not re-do work D0–D7 already did (colors, radius, empty states)
- Do not add animations beyond basic hover
- Do not touch the Mobile app
- Do not add charts on pages that do not need them
- Do not copy the Figma pixel-for-pixel — use it as vocabulary

---

## What "D8 done" looks like

- Sidebar is dark navy with amber accent
- Page background is grey, cards are white, modals float
- Tasks are visually distinct by status
- Alerts are readable and hierarchical
- Documents feel like a file manager
- Dashboard has metric hierarchy and one chart
- Native controls are styled
- No page feels like "a white form on white"
- The app feels intentional

You will not love every pixel. That is fine. That is D8.6 (the
infinite polish loop you should not enter). Stop at "feels
intentional."

---

## What comes after D8

- Phase 4 — Execution Loop (functional)
- Phase 5 — Control Tower real data
- Phase 6 — Hardening
- Phase 7 — Sales
- D9 — Dark mode (separate, optional, later)

---

## Save this file

Path: docs/plan/13-d8-redesign.md

Also save the Figma export as:
docs/design/d8-worker-dashboard-reference.css

Commit both.