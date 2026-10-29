# Dashboard / Control Tower — Reference Mapping

**Scope:** bounded visual refactor of the production `ControlTowerSurface`; no API, authorization, route, Attendance, or unrelated module changes.

## Phase 1 — Audit and reference evidence

### Existing HIIEKO surface

- `/` routes `worker` to `WorkerMyDay`, `team_leader` / `technician` / `foreman` to `WorkerDashboard`, and the remaining roles to `ControlTowerSurface` (`web/src/app/page.tsx`). The canonical `/control-tower` route redirects to `/`; preserve both behaviors.
- `CONTROL_TOWER_ROLES` defines the Control Tower route roles. Backend overview, drilldown, and red-flags endpoints apply JWT/role guards and optional project-access scope (`backend/src/modules/control-tower/control-tower.controller.ts`). The UI passes `selectedProjectId` through to all three endpoints. Keep server authorization authoritative.
- The existing user-modified surface calls `getControlTowerOverview`, `getControlTowerRedFlags`, `getControlTowerDrillDown`, and the activity API. Preserve its request-race guard, independent loading/error states, project filter, refresh, drilldown drawer, severity filters, persistent collapse controls, and directly linked deadline rows.
- Existing data supports: active-project summaries (name/code/stage/progress/target date), overdue/upcoming deadlines, workforce attendance and overtime, today's planned/completed/blocked work, material shortages/stock/deliveries, budget/actual/committed/forecast/variance, QA/NCR/correction counts, documentation counts, rule-generated red flags, and recent activity. None of these should be represented as computed project health or new alert types.
- Role-aware focus copy and quick links already exist in `ControlTowerSurface`. Some profile/quick-workflow links were not allowed by `ROUTE_ROLES` (notably `/projects` for finance/director roles); shortcuts, activity destinations, and the activity “view all” link now respect the existing route contract. Project-detail links remain for authorized project roles; other Control Tower roles inspect an exact scoped deadline record through the existing drilldown. Other home roles are not in scope and must not be changed.
- Shared UI available in scope: `Card`, `Button`, `EmptyState`, `ErrorState`, `Skeleton`, `Pagination`, `ControlTowerRedFlagsCard`, and `ControlTowerDrilldownDrawer`. The existing HIIEKO design guidance calls for Inter, left-aligned work surfaces, accessible status semantics, responsive records, and the established green/amber/navy palette.

### Candidate references — verified vs. unavailable

| Reference | Verified evidence | Use / limitation |
|---|---|---|
| [Velora Portfolio Dashboard](https://velora.ai/docs/velora-platform/velora-platform-portfolio-dashboard/) | Read the current documentation and inspected both linked screenshots (`portfolio-overview.png`, `portfolio-operations.png`). Visible: title with project filter and refresh, Health/Operations tabs, a compact portfolio status strip, paired schedule and quality panels, and a project table whose rows are clickable. Operations presents grouped metrics followed by a wide project table. | Borrow compact framing, scanning order, and actionable project rows only. Do not add tabs, sorting, a new project-health model, health scores, safety/headcount fields, or KPI families absent from HIIEKO's existing DTO. |
| [BuildAxis AI ERP — Dribbble](https://dribbble.com/shots/27403924-BuildAxis-AI-ERP-Construction-Management-Dashboard-UI-Design) | Dribbble's page request is intercepted by its AWS WAF challenge, but the indexed CDN screenshot was retrieved and visually inspected. It shows a construction ERP with a left rail, six metric tiles, action row, usage/consumption tables and charts, supplier/warehouse summaries, recent activity, and alerts. Search indexing exposes palette tags (`#F8F9FB`, `#A5B2C0`, `#15171A`, `#444F5C`, `#0223EE`, `#6799CE`, `#C2703F`, `#3352AD`); those tags are not a verified design-token specification. | Layout evidence is verified from the CDN screenshot. Borrow only the attention-first scan and construction-record grouping; do not import unsupported metrics, charts, supplier/warehouse data, or colors. Retain HIIEKO's own approved tokens. |

## Phase 2 — Reference-to-functionality mapping

| HIIEKO information/action | Existing source | Presentation decision |
|---|---|---|
| Current role, permitted workflow destinations | `useAuth`, `roleProfile`, `CONTROL_TOWER_ROLES`, `ROUTE_ROLES` | Keep role focus; show only destinations allowed by the existing route contract; suppress activity links to unavailable modules; do not widen role access. |
| Current project scope and data refresh | `ProjectContext`; overview/red-flags/drilldown requests with `selectedProjectId` | Keep the top-right project filter and refresh control; preserve project context on every request. |
| Role-relevant first scan | Existing `ControlTowerOverviewDto` fields | Surface a small role-weighted summary using only fields already returned; each actionable value opens its existing category drilldown or existing authorized route. All domain details remain available below. |
| Critical operational exceptions | `GET /api/control-tower/red-flags`; `ControlTowerRedFlagsCard` | Keep severity counts/filtering and inspect drawer; maintain this before broad operational summaries. |
| Overdue/upcoming project targets | `projects.overdueProjectsList`, `upcomingDeadlinesList` | Keep distinct warning groups. Project-route roles link to `/projects/:projectId`; other Control Tower roles open the exact scoped deadline record in the existing drawer. |
| Existing project summaries | `projects.activeProjectsList` (`id`, `name`, `code`, `stage`, `progressPercent`, `targetEndDate`) | Add a concise project roster with actual progress and a direct project-detail link; no inferred health status or invented metrics. |
| Operational domains | Existing seven domain aggregates and category drilldowns | Retain all seven existing summaries/actions, using shared Card/Button patterns; no decorative charts or new calculations. |
| Recent changes | Existing `/api/activity` request and actual event entities | Keep the 24-hour activity list and existing record-route behavior. |

## Phase 3 — Design plan and critique

- **Palette:** HIIEKO green `#188C51` for brand/action, solar amber `#F59E0B` for attention, site slate `#0F172A` for primary ink, worksite canvas `#F3F4F6`, white reading surfaces, and critical red `#DC2626` only for critical/blocking states. Use existing semantic Tailwind tokens where available; do not adopt BuildAxis's blue/orange swatches as HIIEKO brand colors.
- **Type:** retain the existing Inter; sentence-case 28–32px title, 20–24px section headings, 14–16px primary record text, and readable 12–14px supporting content. Use tabular numerals for actual counts only.
- **Layout:**

```text
DESKTOP
┌──────────────────────────────────────────────────────────────────────┐
│ Control Tower + signed-in role focus       Project filter   Refresh │
│ Existing role-authorized workflow links                              │
├──────────────────────────────────────────────────────────────────────┤
│ Role-relevant real metrics (values open existing detail/workflows)   │
├──────────────────────────────────────────────────────────────────────┤
│ Deterministic red flags                                              │
├─────────────────────────────────┬────────────────────────────────────┤
│ Overdue project targets          │ Upcoming project targets          │
├─────────────────────────────────┴────────────────────────────────────┤
│ Active project summaries (real stage/progress; rows open project)     │
├──────────────────────────────────────────────────────────────────────┤
│ Existing operational domain summaries → quick workflows → activity  │
└──────────────────────────────────────────────────────────────────────┘

MOBILE: the same priority order in one column; filter and refresh stay
reachable; project/alert rows wrap rather than creating page-level scroll.
```

- **Critique:** the reference's health/operations tabs and five KPI cards would look neat but require unsupported HIIEKO classifications and data. Reject those, as well as decorative charts and an extra hero/banner. Prefer one role-weighted strip backed by existing metrics, then actual exceptions and clickable records. This keeps the page specific to live construction operations rather than a generic SaaS dashboard.

## Phase 4 — Verification boundary

**Run:** web TypeScript check passed; shared TypeScript check passed; all 10 web Jest suites / 79 tests passed; i18n and frontend-guard checks passed; `git diff --check` passed. A source re-review found the same long red-flags heading rendered at both section and card level; the outer heading now distinguishes the section as “Alerts that need attention.” This is source-only verification, not a visual check. The local Next app returned HTTP 200, and Chrome is installed/open, but there is no browser automation package or DevTools connection available to this session. An authenticated Dashboard could therefore not be inspected at desktop/mobile widths or screenshotted; no visual browser certification is claimed.
