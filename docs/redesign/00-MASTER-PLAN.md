# HIIEKO Web + Mobile Redesign — Master Plan

**Status:** Owner-approved scope and visual direction; planning baseline reconciled. Implementation has not started.  
**Product:** HIIEKO Solar Site Management System  
**Scope baseline:** Existing production web application and existing production mobile application. This is not a marketing-site redesign.

## Objective

Make HIIEKO's existing production web and mobile applications feel like clear, dependable tools for solar-site operations. Improve visual hierarchy, usability, accessibility, and consistency across real workflows while retaining current behavior, data contracts, and platform-appropriate interaction patterns.

The memorable design expression should come from real site operations—work fronts, daily plans, attendance, progress, quality, materials, and project context—not generic SaaS decoration or invented solar imagery/data.

## Fixed scope

In scope under the owner-approved decisions:

- The existing production web routes listed in [03-PAGE-INVENTORY.md](./03-PAGE-INVENTORY.md), including authenticated work surfaces and login/account-recovery surfaces.
- The existing production mobile application. Its screens/workflows must first be inventoried from the current Mobile source; do not invent routes or assume web layouts are appropriate for mobile.
- Existing web shell, role-filtered navigation, page hierarchy, shared visual components, responsive web layouts, and state/copy presentation.
- Existing mobile navigation, platform interaction patterns, offline behavior, and mobile-specific workflows, as found during the separate mobile audit and sequence.
- Visual refinement of existing supported controls and workflows. Each visible action must keep its current API-backed meaning and authorization.
- The first implementation is a bounded, real-data prototype on the existing web `/tasks` route, using existing APIs. Stop for explicit owner review after this prototype; do not expand the web redesign to another route before acceptance.
- A distinct mobile implementation sequence, beginning with a source/workflow audit and mobile-specific design brief after the web prototype review. Do not implement mobile in this planning task.
- Existing Romanian/English localization conventions and existing shared components/tokens where suitable.

## Exclusions

- No new business features, pages, routes, roles, permissions, or workflow semantics.
- No authentication, registration, session, refresh-token, organization isolation, project isolation, API, persistence, database, storage, or backend behavior changes.
- No redesign of `/design-review`, `/design-review/global`, or `/design-review/architecture`; these remain prototype-only routes outside production redesign.
- No new marketing website or new production routes.
- No fake/mock production data, fake IDs, localStorage-as-database, or simulated successful actions.
- No new dependencies, packages, lockfile changes, environment/configuration changes, or edits to `opencode.jsonc` as part of the redesign work unless separately approved.
- No wholesale merge or port of v0, Figma, the legacy D8 direction, or another product's design.
- No scope changes, skipped blockers, destructive changes, commit/push, or database/deployment operation without the applicable explicit authorization.

## Authority and preservation rules

1. `AGENTS.md` and the production architecture (Next.js, NestJS, Prisma/PostgreSQL, shared, Mobile) are authoritative.
2. Current source, route-role contracts, backend authorization, real API behavior, and runtime evidence outrank historical plans and audits.
3. Existing `docs/plan/` and `docs/audits/` remain intact. This chain is the redesign execution plan, not a rewrite of those documents.
4. The working tree was already modified before this planning task. Every implementation session must inspect `git status --short`, preserve existing work, and resolve conflicts before editing.
5. Owner-approved scope and visual anchors are recorded in `DECISIONS.md`. Do not ask the owner to reapprove RD-P01–RD-P03. Implementation details outside those decisions must stay within this plan or be raised as a genuine scope change.

## Phase gates

| Gate | Required evidence | Approval |
|---|---|---|
| G0 — Scope and design anchors | Owner-approved decisions RD-P01–RD-P03 are recorded in `DECISIONS.md`; this is complete. | No reapproval of these decisions is required. |
| G1 — `/tasks` baseline and bounded brief | Inspect current `/tasks` source, APIs, permissions, components, tests, and working-tree ownership; write the exact implementation file/scope and acceptance checklist. | Proceed under the existing approval; stop if evidence reveals a genuine scope/authorization conflict. |
| G2 — Real web prototype | Implement only the existing `/tasks` route and directly necessary task feature components, using real API data and current permissions; capture verification evidence. | **Hard owner-review gate:** stop after reporting the prototype. No other web page may be changed until the owner explicitly accepts it. |
| G3 — Web rollout | Expand to other web route families in independently reviewable tasks only after G2 acceptance. | Keep route/API/role behavior unchanged; report and stop on blockers. |
| G4 — Separate mobile sequence | Audit Mobile source and workflows, create a mobile-specific inventory/brief, then implement and verify mobile tasks separately. | Do not copy web layouts; begin mobile implementation only under its sequence and its defined review gates. |
| G5 — Final acceptance | Record full relevant web and mobile visual, responsive, accessibility, functional, automated, and manual evidence; list limitations. | Owner accepts the completed redesign or records remaining work. |

## Definition of done

The redesign is complete only when all of the following are evidenced:

1. All **31 production web route surfaces** in the page inventory are reviewed; every in-scope route is updated and accepted or explicitly deferred. The three design-review prototype routes remain excluded.
2. The Mobile source audit creates a real screen/workflow inventory; every in-scope mobile surface is updated and accepted or explicitly deferred. The mobile design uses platform-appropriate layouts, not assumed web copies.
3. The real `/tasks` web prototype passed the explicit G2 owner review before any other web page was changed.
4. Every changed surface retains its existing route/screen, role contract, organization/project scope, API-backed actions, authentication/session behavior, and persistence. No production mock data or unsupported action is introduced.
5. Changed web pages have no horizontal overflow at **390 px, 768 px, 1280 px, and 1440 px**; mobile app layouts are evaluated against their own platform/device requirements after the Mobile audit. Any exception is explicitly documented and accepted.
6. Keyboard users can reach and operate changed web controls; mobile controls follow platform accessibility conventions. Focus, semantics, contrast, status text, and reduced-motion are reviewed as applicable.
7. Romanian/English web copy and supported mobile localization remain coherent. Relevant loading, empty, no-results, error, denied, disabled, saving, and success states are reviewed where they exist.
8. Applicable existing tests, web typecheck/build, Mobile checks, and i18n/guard checks are actually run and exact outcomes recorded. Browser/device workflow review is also required; a build alone is not acceptance.
9. No unresolved high-impact issue is hidden. Blocked checks, approved deferrals, and limitations are listed in `STATE.md` and handoffs.
10. After every implementation task, the standard handoff is provided, `STATE.md` is updated, and significant decisions are recorded in `DECISIONS.md`.

## Document chain and use

Read in order before redesign implementation:

1. [01-AUDIT.md](./01-AUDIT.md) — evidence-based product and architecture baseline.
2. [02-DESIGN-SYSTEM.md](./02-DESIGN-SYSTEM.md) — approved visual anchors and implementation guidance.
3. [03-PAGE-INVENTORY.md](./03-PAGE-INVENTORY.md) — routes, purposes, dependencies, and acceptance.
4. [04-IMPLEMENTATION-ROADMAP.md](./04-IMPLEMENTATION-ROADMAP.md) — one small task at a time, prototype first.
5. [05-REVIEW-AND-QA.md](./05-REVIEW-AND-QA.md) — required review and verification.
6. [STATE.md](./STATE.md) — live phase, evidence, blockers, next task, and required approval.
7. [DECISIONS.md](./DECISIONS.md) — settled constraints and owner decisions; do not reopen settled choices without new evidence or owner request.

### Review-to-next-task protocol

After each implementation task, stop and report: changed files; actual commands/checks and outcomes; visual/manual evidence; outstanding issues or blocked checks; scope/behavior confirmation; and one proposed next task. Update `STATE.md` and record significant approved choices in `DECISIONS.md`. Wait for review/approval wherever a gate says so. Never claim an unrun check passed, silently skip a blocked task, or silently alter scope. The reusable prompt and handoff form are in [04-IMPLEMENTATION-ROADMAP.md](./04-IMPLEMENTATION-ROADMAP.md).

---

**Current outcome:** Scope and visual anchors are approved. The next task is source inspection and preparation of the bounded web `/tasks` prototype. Stop for explicit owner review after that prototype and before any other web redesign work.
