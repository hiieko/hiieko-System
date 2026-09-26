# HIIEKO — IMPLEMENTATION ROADMAP

**Date:** 2026-09-18/19 · **Companions:** `PROJECT_AUDIT.md`, `ARCHITECTURE_MIGRATION_PLAN.md`, `FEATURE_GAP_ANALYSIS.md`, `DATABASE_MIGRATION_MAP.md`, `API_MIGRATION_MAP.md`, `TECHNICAL_DEBT.md`.
**Ordering principles:** stabilize → don't lose data → make the API layer exist → move data ownership → enrich features. New EPC features (§5–§50) are built as new NestJS modules over the migrated schema, not as more client-side pages.

## Milestone R0 — Stabilize current repo (prerequisite for everything)
| Package | Tasks | Exit criteria |
|---|---|---|
| R0.1 | Fix dashboard (`time_logs`, worker counts) — TD-001/002 | dashboard renders real data on a live project |
| R0.2 | Wire mobile login + real user object; remove demo fallback — TD-003/029 | device login E2E |
| R0.3 | Make mobile submits persist (insert or queue) — TD-005 | no alert-only paths for attendance/report/delivery/expense |
| R0.4 | Wire `syncOfflineQueue` behind connectivity detection — TD-004/022 | queue flushes when online |
| R0.5 | OCR provider cleanup + draft pruning — TD-007/023, ISSUE-003/004 | no Google Vision references |
| R0.6 | `.git init`, CI skeleton (typecheck+tests+build), ignore/env hygiene — TD-008/009/010/011/012 | green pipeline |
| R0.7 | Live `/pontaj`+`/stocuri`+`/rapoarte` (via direct tables first) — TD-015 | mocks removed |

Effort: ~2–3 weeks (single dev) · Blocked by: none (works without Supabase keys; live keys needed for runtime E2E).

## Milestone R1 — NestJS foundation
| Package | Tasks | Exit criteria |
|---|---|---|
| R1.1 | Add `backend/` NestJS workspace + root scripts | `npm run backend:*` green |
| R1.2 | JWT guard vs Supabase JWKS + `AuthorizationService` port of RLS predicates | auth tests pass |
| R1.3 | Health, profiles, auth endpoints (API map §1–§3) | web login/profile through API |
| R1.4 | Typed `ApiClient` seam in web+mobile with `SupabaseApiAdapter` (behavior unchanged) | typecheck + smoke test |
| R1.5 | Error envelope + validation + audit service scaffold | 401/403/404/422 contract test |

Effort: ~2 weeks · Depends: R0.

## Milestone R2 — Core operations through the API (dual-write)
| Package | Tasks | Exit criteria |
|---|---|---|
| R2.1 | Sites/teams/assignments → `projects`/`project_members` (DB map §A.2) with dual-write + drift-checker | ✅ **P6 CLOSURE (2026-09-24)** — All 6 phases complete. P1–P5: shared contracts, mobile/web migration, authorization, backfill. P6: documentation reconciliation. |
| R2.2 | Attendance module (clock-in/out, shared calc server-side, geofence verdict) | time_logs written by API; web matrix live |
| R2.3 | Stock module (balances/movements/avize; DB invariants intact) | ✅ **E2E VERIFIED** — 30/30 live tests; four-layer defense; per-project aviz; atomic posting |
| R2.4 | Daily reports module (header+items+approvals table) | report submit & approve E2E |
| R2.5 | Notifications module (read/mark; later channels) + audit writes | center feeds from API |

Effort: ~3 weeks · Depends: R1.

> **Architecture Decision (2026-09-23) — dual-write scope:** The "(dual-write)" label on this milestone is a *transition-time coexistence* mechanism, not a permanent requirement. PostgreSQL/NestJS is the authoritative target; there is no live Supabase project/keys and no `legacy.*` schema in dev, so there is no active legacy consumer to mirror to. Accordingly: R2.2/R2.4 legacy helpers (`upsertLegacyTimeLog`, `upsertLegacyDailyReport`) were kept but annotated `⚠️ TEMP — REMOVE AT R7 CUT-OVER`; **R2.3 Stock and R2.5 Notifications are implemented PostgreSQL-authoritative with NO legacy dual-write.** Legacy `legacy.*` mirroring is decommissioned at Milestone R7. See `PROGRESS.md` → Architecture Decision.
>
> **P6 Closure Note (2026-09-24):** The R2.2/R2.4 legacy helpers have been **REMOVED** (2026-09-23) as confirmed by live-DB verification. There is no remaining dual-write code in the active tree. R2.3 Stock and R2.5 Notifications were PostgreSQL-authoritative from the start.

## Milestone R3 — Expenses, approvals, offline persistence [OCR FROZEN/DEFERRED]
| Package | Tasks | Exit criteria |
|---|---|---|
| R3.1 | Expenses API (create w/ documents + OCR refs; states; self-approval guard) | `/cheltuieli` + `/aprobare` fully live |
| R3.2 | Reimbursement admin flow | §71 E2E |
| R3.3 | `ocr_jobs` backend + Paddle adapter + XML adapter; retire Edge fn | OCR E2E via API |
| R3.4 | Mobile SQLite + sync states + conflict UX (WS-E) | offline→online round-trip incl. media |
| R3.5 | File service + buckets (avize/report-photos/engineering/QA/handover) | signed-URL access RLS-equivalent |

Effort: ~4 weeks · Depends: R2.

## Milestone R4 — Project Control & Planning (new EPC modules)
| Package | Tasks | Exit criteria |
|---|---|---|
| R4.1 | `projects` + phases (§5–§8): health indicators from defined rules | project file CRUD + health E2E |
| R4.2 | Task engine (§16–§21): statuses, dependencies, assignments, blocked reasons, duplicate-work warnings, plan vs actual | task workflows E2E (incl. blocked dashboard) |
| R4.3 | Engineering docs + document control (§9–§10) | revision/approval/supersede E2E |
| R4.4 | Procurement (§11–§12): requirements→request→PO→delivery + alerts | procurement loop E2E |

Effort: ~6 weeks · Depends: R2 (schema) — can start in parallel with R3.

## Milestone R5 — Quality, Issues, Finance
| Package | Tasks | Exit criteria |
|---|---|---|
| R5.1 | QA/QC (§38–§39): inspection templates, tests, company-defined acceptance criteria | inspection workflow E2E |
| R5.2 | NCR + issue register + red-flag engine (§40–§42) | alerts generated with WHY/WHO/WHEN/WHAT/NEXT |
| R5.3 | Change orders (§37) — audited scope/budget/schedule updates | CO workflow E2E |
| R5.4 | Project finance (§34–§36, §43, §26): budget/actual/committed/forecast, cost breakdown, labour rates | cost view matches DB |
| R5.5 | Control Tower (§3–§4, §20, §68, §93–§94) with drillable metrics | tower from real data |

Effort: ~6 weeks · Depends: R3 + R4.

## Milestone R6 — Completion layer & platform polish
| Package | Tasks | Exit criteria |
|---|---|---|
| R6.1 | Commissioning (§50) + Handover (§49) with required-deliverables gate | gates enforce completion |
| R6.2 | Safety module (§63) | observations/incidents/toolbox E2E |
| R6.3 | QR/barcode real scanning; asset/equipment mgmt (§60–§62) | scan→stock/asset E2E |
| R6.4 | Notification channels (push/email) + offline security (§65, §78) | channel adapters + device lock |
| R6.5 | i18n coverage + error/empty states sweep (§67, §79–§80) | no hardcoded UI strings |

Effort: ~5 weeks · Depends: R5.

## Milestone R7 — Decommission & Harden
| Package | Tasks | Exit criteria |
|---|---|---|
| R7.1 | Cut-over: clients disable Supabase adapters; legacy mirror freeze | all E2E green via API only |
| R7.2 | Remove `@supabase/supabase-js` from clients, Edge function, legacy demo data archive | zero dangerous imports |
| R7.3 | Performance/observability (logging, metrics, alerts); backup/restore drill | documented runbook |

Effort: ~2 weeks · Depends: R6.

## Estimated complexity by module (S/M/L = effort class; totals indicative for one senior dev)
| Module | State today | Complexity to target | Where it lands |
|---|---|---|---|
| Auth & roles | 🟡 30% | M | R1, R4.1 |
| Web shell + i18n + tutorials | ✅ 80% | S | R0 |
| Attendance + overtime | 🟡 40% | S–M | R2, R4 |
| Stock + avize | 🟡 50% | M | R2–R3 |
| Daily reports | 🟡 40% | M | R2 |
| Expenses + approvals + OCR | 🟡 45% | M–L | R3 |
| Notifications | 🟡 35% | M | R2, R6.4 |
| **Mobile offline + sync (SQLite)** | 🧪 10% | L | R3.4 |
| Projects + planning + tasks | ➖ 0% | L | R4 |
| Procurement | ➖ 0% | L | R4.4 |
| QA/QC + issues + NCR | ➖ 0% | L | R5 |
| Finance/costing/forecast/control tower | ➖ 0% | L | R5–R6 |
| Commissioning + handover + safety | ➖ 0% | L | R6 |
| Storage/files/docs control | 🟡 20% | M–L | R3.5, R4.3 |
| Audit + reporting APIs | 🟡 15% | M | R1–R5 |

## Critical path & risks
- Critical path: R0 → R1 → R2/R3 → R4 → R5 → R6 → R7. R4.1–R4.4 can start in parallel with R3 (schema dependency only).
- Top risks: no live project/keys (verification blind spot); silent data-loss patterns in mobile today; authorization port fidelity; scope creep of the EPC layer; no VCS/CI baseline.
- **Exit discipline:** every milestone ends with typecheck + unit tests + targeted E2E; nothing is merged on a "screen exists" basis (spec §99 definition of done).

*Final audit report (14-point) is reproduced in the session summary and references these documents.*