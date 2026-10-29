# HIIEKO Web + Mobile Redesign — Design System

**Status:** Owner-approved visual direction; implementation guidance for web and the separate mobile sequence.  
**Design basis:** Existing HIIEKO solar-site workflows and the installed Anthropic `frontend-design` skill at `.opencode/skills/frontend-design/SKILL.md`. No other skill or package is required or authorized.

## Brief and design principle

**Audience:** people coordinating or doing solar-PV construction work—field crews, team leaders, site/project managers, QA/QC, materials, finance, and administrators.  
**Primary job:** make the next real site action, its project context, its owner, and its status immediately understandable without hiding detail or weakening access control.

Use the visual language of a working site plan: clear work fronts, concise task rows, measured progress, project context, and legible operational records. The interface should feel precise and usable in bright field conditions, not like a generic SaaS dashboard or a marketing landing page.

## Approved visual anchors and supporting tokens

These anchors operationalize the owner-approved direction (RD-P02) and existing HIIEKO tokens. Retain existing semantic status tokens where suitable and verify contrast during implementation.

| Name | Hex | Role |
|---|---|---|
| HIIEKO green | `#188C51` | Brand/action emphasis and active web navigation; not a blanket status color. |
| Solar amber | `#F59E0B` | Attention, pending work, and solar-specific emphasis; never the only status cue. |
| Site slate | `#0F172A` | Navy web navigation/shell anchor and primary ink. |
| Worksite canvas | `#F3F4F6` | Quiet page background separating work areas from the surface. |
| Drawing paper | `#FFFFFF` | Reading/form surfaces. |
| Critical red | `#DC2626` | Destructive, blocked, or critical conditions only, paired with words/icons. |

Secondary text, borders, muted surfaces, success, warning, and info should map to existing semantic tokens in `globals.css`/Tailwind. The current teal literal in `Sidebar.tsx` conflicts with the approved green/amber/navy direction: replace it with the approved system's green active treatment in the appropriate web shell task, after the `/tasks` prototype owner gate. Do not change code as part of this plan. Amber is for attention/solar emphasis, not a competing brand or navigation color. Check contrast for text and controls.

## Typography

- Retain the currently loaded **Inter**: it is already used across the app and avoids a font/package/network dependency during the redesign. Replacing it would be a design-scope change, not an implementation default.
- Build character through a deliberate scale and contrast, not a decorative font: large sentence-case page titles; compact, readable section headings; body copy optimized for scanning; tabular numerals for quantities, dates, and operational measures where useful.
- Proposed scale: page title 28–32 px; section title 20–24 px; item/form heading 16–18 px; body/control 14–16 px; supporting text 12–14 px. Do not make critical field labels or status text tiny.
- Keep ordinary line lengths under roughly 80 characters, use sentence case, and use clear active-verb action labels. Avoid ornamental all-caps eyebrows, one-word color accents, and monospace labels added only for decoration.
- Do not add or load another font or dependency under this redesign plan.

## Spacing, shape, and elevation

- Use a consistent 4 px base rhythm; common gaps 8/12/16/24/32 px.
- Respect the existing AppShell page gutters and max-width; page content remains left-aligned. Use centered alignment only for concise empty/auth states where it improves comprehension.
- Preserve a small radius vocabulary: controls/small chips around 6–8 px, cards/dialogs around 10–12 px, pill shape only when it communicates a compact state. Do not use the same container treatment for every element.
- Use borders and whitespace for work-area separation. Reserve elevation for overlays and genuinely floating controls; no blanket card shadows, decorative gradient washes, or card-within-card grids.
- Keep dense operational tables readable; prefer responsive reprioritization or stacked records to simply shrinking text.

## Layout and navigation concept

### Preferred concept — “workfront first”

For **web**, the first viewport answers: **which project/site, what needs attention now, what can this role do next?** A stable shell carries role-aware destinations and project context. The page body uses one clear work surface, a compact filter/action band, and supporting detail in a secondary column only when it helps the actual workflow.

```text
DESKTOP (manager / site context)
┌───────────────┬──────────────────────────────────────────────────┐
│ HIIEKO        │ Project/site context     Date     Account/actions │
│ role-filtered ├──────────────────────────────────────────────────┤
│ navigation    │ Page title + one plain-language purpose/action    │
│               │ [search / filters / real primary action]          │
│               ├────────────────────────────────┬─────────────────┤
│               │ Workfront / record list        │ Attention/detail│
│               │ Real statuses, owners, dates   │ only if useful  │
└───────────────┴────────────────────────────────┴─────────────────┘

WEB AT NARROW WIDTHS (not a prescription for the separate Mobile app)
┌──────────────────────────────────┐
│ Project/site      Menu / profile │
├──────────────────────────────────┤
│ Page title + one primary action  │
│ Project/date context             │
│ Filters (compact, open on demand)│
│ Priority-first task/record rows  │
│ Details/actions in readable flow │
├──────────────────────────────────┤
│ Existing role-aware bottom nav   │
└──────────────────────────────────┘
```

### Deliberate comparison

- **Choose:** a workfront-first list/detail composition; let real task, attendance, project, delivery, or inspection content supply the visual character.
- **Reject as default:** a row of equal KPI cards followed by generic cards/charts. Use a metric or chart only when the real page and available API data make it an actionable answer.
- **Reject:** full-bleed stock-photo solar hero, fake map/roof diagram, decorative status bars, and new folder/category metaphors unsupported by real data.

This is the `frontend-design` skill's plan → critique → build → self-review sequence. The proposed workfront-first structure is specific to HIIEKO's site-operation audience; if it begins to look like a generic component kit, simplify it before building.

### Separate mobile application

The React Native Mobile app is in redesign scope, but its screen composition is not defined by the web wireframe above. Start with the separate Mobile roadmap audit of actual screens, navigation, role paths, offline/online flows, data entry, device affordances, and existing tests. Build a mobile-specific design brief from those findings, retaining the approved green/amber/navy direction and semantic meaning where suitable while respecting native interaction patterns. Do not invent screens or assume web routes map one-to-one to mobile screens.

## Navigation

- Preserve existing route paths, route-role contracts, desktop `NAV_GROUPS`, mobile role-specific destinations, More sheet, project selector, language switcher, notifications, and account/logout behavior.
- Improve visual hierarchy and current-location clarity without adding destinations or changing which role can see/open a route.
- Do not make navigation discoverability changes that bypass route authorization or project scope. Long labels must remain readable in Romanian and English.

## Components and content rules

Prefer the existing shared UI and domain components: PageHeader, PageContainer, Button, Input, Card, Badge, Tabs, Modal/Drawer, ConfirmDialog, Skeleton, EmptyState, ErrorState, Pagination, task/planning/report/QA/document feature components, and shell components.

- Create no component solely to decorate a page. If a genuinely reusable component is needed, keep it small, localized, and separately verifiable; no package or API additions.
- Preserve existing API-backed list/actions and show action labels that describe the actual result. Do not add unsupported filters, file categories, chart data, role affordances, statuses, or interactions.
- Use real project/task/inspection/document data only. Empty and failure states should explain the condition and next safe action, without leaking unauthorized record metadata.
- Keep Romanian/English copy in the existing shared translation system; no mixed-language UI.

## Interaction states

For each affected control/page, inspect and preserve applicable states: initial/loading; populated; empty; filter/search no-results; error/retry where the current flow supports retry; access denied; disabled; submitting/saving; confirmed success; destructive confirmation; expanded/collapsed; keyboard focus/active; and reduced-motion. No visual state may falsely imply that a server action succeeded.

Status is communicated by text/icon/shape as well as color. Use green for brand/action, not as a universal “good” decoration; amber for attention; red for critical/destructive. Verify foreground/background combinations rather than trusting color names.

## Accessibility and responsive behavior

- Target WCAG 2.2 AA for applicable text and UI contrast; do not rely on color alone.
- Preserve semantic headings/landmarks, associated labels, button/link semantics, accessible names for icon-only controls, keyboard operation, visible focus, dialog focus management, Escape behavior where appropriate, and live announcements for meaningful async outcomes.
- Honor `prefers-reduced-motion`; no ambient animation. Motion should explain user-triggered state changes only.
- At 390 px: one-column work flow, role-aware bottom navigation, safe-area clearance, touch targets ideally at least 44×44 px, no clipped labels or horizontal page scroll.
- At 768 px: allow filters/detail to reflow; keep primary actions and project context available.
- At 1280/1440 px: use the existing desktop shell and readable content width; do not stretch lists/paragraphs across the whole screen.
- Treat the solar configurator as a specialized editor, not as a CRUD page; preserve its canvas/tool workflow and explicitly test any mobile adaptation rather than forcing a generic stacked form.

## Implementation guidance and review boundary

The owner has approved the high-level visual direction and the web `/tasks` prototype-first sequence; do not request approval for RD-P01–RD-P03 again. Use this system to prepare the bounded prototype after inspecting current code and contracts. The exact `/tasks` implementation must meet its inventory/QA criteria and stop for owner review before any other web page is changed. The Mobile sequence must first produce a mobile-specific audit and brief; do not transfer the web wireframe to Mobile. Record any material new decision or deviation in `DECISIONS.md` and `STATE.md`.
