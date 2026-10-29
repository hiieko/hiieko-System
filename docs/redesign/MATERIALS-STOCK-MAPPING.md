# Materials / Stock — Reference-to-Functionality Mapping

**Status:** source-grounded mapping and implementation record. The Stock UI refactor is complete; the API and backend contracts remain unchanged.

## Phase 1 — Existing HIIEKO implementation

### Route and role access

- Production route: `web/src/app/stocuri/page.tsx`; wrapped in `RoleGuard` using `ROUTE_ROLES['/stocuri']` (`OPERATIONAL_ROLES`: admin, owner, manager, PM, site manager, foreman, team leader, technician, worker).
- UI mutation predicates and backend action roles are:
  - Receive: admin, owner, manager, procurement, site manager, team leader.
  - Consume: admin, owner, manager, site manager, team leader.
  - Transfer: admin, owner, manager, procurement, site manager.
- **Existing mismatch:** Procurement is included in the Receive and Transfer UI predicates and backend role decorators, but Procurement is not in `/stocuri`'s `OPERATIONAL_ROLES` route guard. Therefore Procurement cannot reach those buttons on this page through normal routing. This mapping records the mismatch; it does not change route or action permissions. RoleGuard and backend RolesGuard preserve the established admin/owner bypass.

### Real API and data

`StocuriPageInner` calls the existing client through `web/src/lib/api-client.ts`:

| Use | Client / HTTP endpoint | Existing fields and behavior |
|---|---|---|
| Active material catalog | `getMaterials()` → `GET /api/materials` | Backend returns active catalog records ordered by code. Page uses `id`, `code`, `name`, `unit`, `barcode`, `category`, `min_stock_threshold`. |
| Current balances | `getStockBalances({ projectId? })` → `GET /api/inventory/stock` | Optional selected project; API returns material plus project/warehouse relations. Page uses balance row id, material id, `current_quantity`, project and material details. Server applies project membership/global-role scope; without a project filter, members are restricted to their authorized projects. |
| Movement ledger | `getStockMovements({ projectId? })` → `GET /api/inventory/movements` | Newest first; backend returns at most 100 movements. Current page uses type, quantity, time, material, project and notes; client pagination is over this returned window. Page size is 10 at widths ≤639px and 20 above; the card/table presentation switches separately at the `md` breakpoint (768px). |
| Receive | `receiveStock()` → `POST /api/inventory/receive` | Page requires selected project and sends material, positive quantity, optional notes, and an idempotency key. It does not use warehouse, lot, or unit-price fields supported elsewhere in the API. |
| Consume | `consumeStock()` → `POST /api/inventory/consume` | Page requires selected project and sends material, positive quantity, optional notes, and an idempotency key. Backend validates sufficient stock and keeps ledger references server-controlled. |
| Transfer | `transferStock()` → `POST /api/inventory/transfer` | Page transfers between the selected project and a different project from `getProjects()`. It sends material, quantity, optional notes; current UI does not send an idempotency key. The backend checks access to both project ids and records outgoing/incoming movements atomically. |

The inventory controller applies `ProjectAccessGuard` and `buildScopedProjectWhere` to stock balance and movement reads. Transfer checks both source and target project access. The page loads materials, balances, and movements together; it fetches the project list only for roles allowed to transfer. No persistence is local or mocked.

### Current page content, interactions, and states

- Sticky `PageHeader` with title, scope inherited from `ProjectContext`, search, role-allowed Receive / Consume / Transfer controls, and Refresh.
- Four current counts: balance rows (`balances.length`), balance rows intended to be marked at/below minimum, rows in the returned movement window, and active catalog records. These are counts—not stock valuation, purchase-order totals, or organization-wide totals. The threshold serialization issue below means the low-stock count/badges can currently under-report.
- Current stock table on desktop and stacked balance rows on mobile; fields shown include material code/name/category/barcode, minimum, current quantity/unit, and threshold status.
- The same search filters balances by catalog fields and project name, and filters movements by material/project/type/notes. A separate movement-type filter is populated from types present in the currently returned 100 records.
- The movement audit has separate desktop table and mobile list; the modal supports the existing receive, consume, and project-to-project transfer workflows.
- Existing states: page-level skeletons; load error with retry; search/filter empty states with clear actions; no-stock empty state with role/project-gated receive action; inline mutation error; disabled/saving buttons; modal close is blocked while saving; pagination resets when relevant filters or viewport page size change.
- Shared components already used: `PageHeader`, `Button`, `Card`, `Badge`, `EmptyState`, `ErrorState`, `Skeleton`, `Modal`, `Pagination`, `PageTutorial`, `useProject`, `useAuth`, and `useMediaQuery`.

### Audit findings to carry into implementation

1. **Low-stock threshold serialization:** Prisma `Decimal` JSON serialization produces a string (verified locally: `JSON.stringify({ value: new Prisma.Decimal('1.250') })` yields `{"value":"1.25"}`). The `/api/materials` service returns `min_stock_threshold` directly from Prisma, while the page classifies it only when `typeof threshold === 'number'`. Consequently the summary and row badges can fail to classify low-stock materials for the real serialized response. The visual refactor should normalize the existing value safely before comparing; do not change the backend response contract.
2. **Counts need honest labels:** balance rows can be per material/location, movement rows are capped at 100, and the low-stock count is per balance row. Do not imply distinct-material totals, all-time movement counts, or monetary stock value.
3. **Location context is underused:** the stock endpoint includes project and warehouse relations. The page interface/rendering omits warehouse context, and mobile rows omit project context even when multiple project balances are visible. Use only the existing returned relation values to disambiguate locations; no new location workflow or endpoint.
4. **Copy is not consistently localized:** several stock table headings and empty/filter strings are hard-coded in Romanian or English despite the shared `stocuri.*` translations and locale toggle. Localize only the copy touched by the page refactor.
5. **Do not add unsupported controls:** the client has optional movement date parameters, but `InventoryController.getMovements` currently accepts only project/material. Do not expose date filters until the API supports them. Do not infer user names from `created_by_id`, reserved/available quantities, values, lots, purchase orders, supplier scores, forecasts, or requisitions from this page's response/interaction contracts.

## Phase 2 — Construction references and evidence

### [BuildAxis AI ERP — Material Management Dashboard](https://dribbble.com/shots/27403924-BuildAxis-AI-ERP-Construction-Management-Dashboard-UI-Design)

The Dribbble page itself is intermittently blocked by its WAF, but the indexed shot image was retrieved directly from its CDN and visually inspected. The image depicts a dense materials workspace with a primary inventory list, low-stock alert area, recent activity, and a movement table, surrounded by many procurement, warehouse, supplier, valuation, chart, and AI panels. Treat it as a design concept, not evidence that those features/data exist in HIIEKO.

**Use only:** material rows as the dominant work surface; make threshold exceptions easy to scan; keep movement history traceable and secondary to current balances; keep actions close to the project/material context.

**Do not copy:** purchase orders/requests, supplier metrics, inventory valuation, allocated/rented/pending quantities, demand forecasting, charts, AI assistant, or warehouse summaries unless an existing HIIEKO field/action explicitly supports the exact representation.

### [Trimble Materials](https://www.trimble.com/en/products/trimble-materials)

The official construction-materials product page describes stock-level visibility and minimum-quantity alerts; its linked inventory screenshot was also retrieved and visually inspected. The screenshot uses a row-oriented warehouse inventory table with location context. It additionally displays fields such as allocated/rented, last price, total value, UPC, and model number.

**Use only:** dense but readable inventory rows and clear location association. In HIIEKO, a project/warehouse label may use the existing included relation when present. Do not import Trimble-specific fields or its warehouse/location model.

## Phase 3 — Reference mapped to current functionality

| Reference pattern | HIIEKO source of truth | Proposed treatment |
|---|---|---|
| Project/site context and focused stock list | `selectedProjectId`, scoped `StockBalance[]` | Keep the global project context and existing search; make the current scope evident without introducing a second project selector. |
| Low-stock exceptions | `Material.min_stock_threshold` + `StockBalance.current_quantity`; current rule is `quantity <= threshold` | Correctly normalize the API's existing numeric representation, retain text/icon status, and surface the real at/below-minimum rows. No new risk score or reorder suggestion. |
| Inventory rows | `code`, `name`, `category`, `barcode`, `unit`, threshold, current quantity; included project/warehouse | Prioritize code/name, location where supplied, available current quantity/unit, minimum and status. Keep barcode/category as supporting scan/search information. Do not calculate available stock from reserved quantity without an existing contract/rule. |
| Movement history | Actual movement type, quantity, created time, material, project, notes; last 100 returned rows | Keep a plain audit ledger with readable movement direction/type and source project; preserve the current movement-type filter and client pagination. Do not add a chart or imply the list is complete history. |
| Receive / consume / transfer | Existing role-gated buttons and modal/API actions | Keep the same operations, fields, project requirements, mutation-role rules, idempotency behavior, and post-save reload. Give the existing actions clear hierarchy without adding warehouse, PO, or request flows. |
| Responsive list and interaction states | Existing mobile cards, desktop tables, `EmptyState`, `ErrorState`, `Skeleton`, `Modal`, `Pagination` | Preserve the mobile reprioritization and states; improve labels/location context and avoid horizontal page scroll. |

## Phase 4 — Proposed HIIEKO visual direction

- **Palette:** existing approved HIIEKO green `#188C51` for primary action/focus, solar amber `#F59E0B` for at/below-minimum attention, site slate `#0F172A`, worksite canvas `#F3F4F6`, white record surface, semantic critical red only where the existing low-stock state calls for it. Retain Inter and existing design-system tokens.
- **Information architecture:** stock is an operational record page, not an analytics dashboard. Keep the page title, selected project context, search and role-allowed actions in one compact header. Place the small existing summary counts below it, with honest scope/window labels. Make current stock the dominant, searchable/paginated work area; keep recent movement history below as the audit trail. Reuse the existing modal for mutations.
- **Desktop concept:**

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Material stock  · current project context      Receive / Consume /… │
│ Search materials…                                      Refresh       │
├──────────────────────────────────────────────────────────────────────┤
│ Existing scoped counts (balance rows · low rows · recent movements) │
├──────────────────────────────────────────────────────────────────────┤
│ Current stock                                                        │
│ Code | Material | Project/warehouse | Minimum | Quantity | Status   │
├──────────────────────────────────────────────────────────────────────┤
│ Movement audit · existing movement-type filter                       │
│ Time | Type/direction | Material | Quantity | Project | Notes        │
└──────────────────────────────────────────────────────────────────────┘
```

- **Mobile concept:** retain one-column balance cards and movement rows, show location and quantity/threshold before secondary identifiers, wrap the already permitted actions, and preserve touch-friendly pagination/modal controls.
- **Critique:** the references show many KPIs, graphs, supplier/procurement panels, and warehouse fields. Those are not HIIEKO's current stock-page contract. Reject them. The distinctive choice is a field-ready stock ledger with clear project/location context, actual shortage status, and traceable inbound/outbound movements.

## Implementation and verification record

- `web/src/features/stock/stock-utils.ts` normalizes finite numeric and Prisma-Decimal JSON string values and applies the existing `quantity <= minimum` rule. `stock-utils.test.ts` covers string serialization, numeric values, equality, zero thresholds, absent/invalid values, and display formatting.
- `web/src/app/stocuri/page.tsx` now presents honest row counts, explicit project context, stock rows with available project/warehouse location, robust low-stock states, localized inventory/movement labels, and responsive desktop-table/mobile-record layouts. The existing search, project scope, movement filter and 100-row window, pagination, role-gated receive/consume/transfer modals, and mutation payloads remain.
- `shared/src/translations.ts` adds the labels and empty states used by this page. No stock API client method, backend controller/service, route permission, or action-role predicate was changed.
- The Procurement route/action mismatch remains unresolved pending an access-policy decision. Movement date filters remain unexposed because the controller does not implement the date query parameters offered by the client method; movement history remains the existing newest-100 window.
- Verification: `npm run typecheck --workspace @solar/web` and `npm run typecheck --workspace @solar/shared` passed; all 11 web Jest suites / 83 tests passed; `npm run i18n:check`, `npm run guards:check`, and `git diff --check` passed. No authenticated browser/DevTools connection was available, so visual certification and Dashboard/Stock screenshots are not claimed.

No Attendance changes, backend contract changes, commits, or pushes were made.
