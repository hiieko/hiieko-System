# HIIEKO — FEATURE GAP ANALYSIS

**Date:** 2026-09-18/19 · **Method:** every spec area scored against the audited repo (evidence in `PROJECT_AUDIT.md`).
**Scale:** ✅ Complete · 🟡 Partial · 🧪 Mock · ❌ Broken · ➖ Missing.

## 1. Core company operations
| Area | State | Evidence / notes | Spec |
|---|---|---|---|
| Employee profiles + roles (4 roles) | 🟡 | `profiles` + role enum + RLS helpers + `/utilizatori`. **Missing:** owner/PM/site manager/technician/procurement/finance/QA/viewer; project+module+action permission granularity | §52 |
| Account application & approval flow | ✅ | signup→application→admin approve/reject + notify + self-approval guard | §51 |
| Teams & site assignments | 🟡 | tables + RLS; no assignment-management UI; `site_assignments` duplicated with `user_site_assignments` | §51/§25 |
| **Company Control Tower** | ❌ | dashboard broken (`attendance_records`, `worker_count:0`); no drill-down, no attention list, no cost blocks | §3–§4 |
| Notifications | 🟡 | DB triggers + web/mobile centers; no push/email/preferences/deep-link nav | §65 |
| Romanian + English | 🟡 | 145 keys + tutorials; many screens still hardcode RO strings | §67 |
| Audit log | 🟡 | table + RLS; nothing writes it from clients | §72 |

## 2. Projects / EPC project control
| Area | State | Notes |
|---|---|---|
| Project as central entity / basic info | ➖ | `sites` is a site, not a project file (no contract/status/phases) | §5–§6 |
| Project health indicators (rules-based) | ➖ | none | §7 |
| Configurable phases | ➖ | only 5-state `site_status_enum` | §8 |
| Engineering module + revisions | ➖ | none | §9 |
| Document control (revision/approval/supersede/private) | 🟡 | only `expense_documents` state machine; no general docs | §10 |
| Planning + plan-vs-actual | ➖ | none | §45 |
| Tasks + dependencies + statuses + assignments | ➖ | none (only daily-report task lines) | §16, §18 |
| Duplicate-work protection | ➖ | none | §17 |
| Blocked-task system + blocked dashboard | ➖ | none | §19–§20 |
| Daily production view | ➖ | none | §22 |
| Change orders | ➖ | none | §37 |
| Project timeline | ➖ | none | §44 |
| Productivity & cost-per-output metrics | ➖ | none | §46–§47 |
| Risk register | ➖ | none | §48 |
| Commissioning & handover gates | ➖ | none | §49–§50 |
| Client portal | ➖ | future phase | §64 |

## 3. Attendance & labour
| Area | State | Notes |
|---|---|---|
| AM VENIT/AM PLECAT + GPS geofence | 🟡 | mobile screen real, **but check-in/out never insert into `time_logs`** (local-only); geo calc from `shared` | §24 |
| Overtime / work-hours calculation | ✅ | `shared` `calculateAttendanceWorkTime` tested; used by mobile; web shows mock | §24 |
| Web attendance matrix | ❌ | `/pontaj` 100% mock | §24 |
| Project-aware labour allocation & labour costs | ➖ | none | §25–§26 |

## 4. Daily reports
| Area | State | Notes |
|---|---|---|
| Mobile daily report | 🟡 | screen + draft + offline enqueue; online path alert-only; no photos (Unsplash), no equipment/QA/weather | §23 |
| Web review/approve | ❌ | `/rapoarte` mock; approve button no-op; report self-approval trigger disabled | §23 |
| Report ↔ tasks/materials links | ➖ | plain rows, no FK to tasks/stock ledger | §23 |

## 5. Materials, stock, procurement, avize
| Area | State | Notes |
|---|---|---|
| Materials catalog | ✅ | table + barcode + thresholds + seed | §13 |
| Stock ledger + integrity | 🟡 | **DB layer excellent** (immutable movements, no over-draw); web `/stocuri` mock; mobile delivery never posts | §13–§14 |
| QR/barcode scanning | 🧪 | `Alert` simulation | §15 |
| Aviz intake | 🟡 | mobile screen (no real photo), web `/avize` reads real data; inserts only via never-synced queue | §33 |
| Warehouse / multi-warehouse / transfers | 🟡 | `warehouses` only; no UI/transfers | §13 |
| Procurement (requirements→orders→deliveries) | ➖ | none | §11–§12 |
| Invoice → stock receipt draft | ➖ | none | §32 |

## 6. Expenses, reimbursements, finance
| Area | State | Notes |
|---|---|---|
| Expense lifecycle (9 states) | 🟡 | statuses + RLS + guard + `/aprobare`; reimbursement UI missing; mobile online submit alert-only | §27 |
| Receipt camera→OCR→review | 🟡 | `ReceiptScanFlow` complete-ish; needs deployed function+service | §28 |
| OCR original vs corrected | 🟡 | columns exist; mobile writes OCR only, no corrections write | §29 |
| OCR confidence flags | ✅ | `getLowConfidenceFields` + review UI | §30 |
| Invoice→stock link | ➖ | none | §32 |
| Project finance / budget / forecast / cost breakdown / cost-risk / labour cost | ➖ | none (only `sites.budget`) | §34–§36, §43, §26 |
| Reimbursement admin flow | 🟡 | table only | §71 |

## 7. QA/QC, safety, commissioning
| Area | State | Notes |
|---|---|---|
| Inspections / checklists / tests / acceptance criteria | ➖ | none | §38–§39 |
| NCR / defects | ➖ | none | §40 |
| Issue register + red-flag engine | ➖ | none (only low-stock trigger) | §41–§42 |
| Safety module | ➖ | none | §63 |
| Commissioning / handover | ➖ | none | §50, §49 |

## 8. Mobile platform
| Area | State | Notes |
|---|---|---|
| Field-first screens | 🟡 | attendance/report/delivery/expense/notifications/settings exist; **no "Today/Plan/Loads/Problems" screens, no clock-in→server** | §53–§54 |
| **SQLite offline DB** | ➖ | **documented, does not exist** — AsyncStorage JSON only | §55 |
| Sync states / idempotency / conflicts | 🧪 | queue + idempotency scaffold; **sync never invoked**; no conflict UX | §56–§57 |
| Camera / scan processing | 🟡 | rotation/crop/upscale on-device; no auto-detect/perspective in managed Expo | §58–§59 |
| QR/barcode (materials, tasks, docs, assets) | 🧪 | simulation | §60 |
| Photos tied to entities | 🟡 | receipt scans only | §58 |
| Equipment/assets + availability | ➖ | none | §61–§62 |
| Offline data protection | ➖ | plain AsyncStorage, no app lock | §78 |

## 9. OCR engine & documents
| Area | State | Notes |
|---|---|---|
| PaddleOCR RO parser / validation | ✅ | unit-tested; inference unverified here | §29–§31 |
| e-Factura XML | ✅ | parser path exists; live call unverified | §29 |
| Provider abstraction | 🟡 | type + passthrough; Google Vision leftovers | §31 |
| Backend-owned OCR jobs | ➖ | Edge Function is fire-and-forget | §31 |

## 10. Cross-cutting
| Area | State | Notes |
|---|---|---|
| Error handling (what/data-preserved/what-to-do) | 🟡 | partial (OCR flows) | §79 |
| Empty states with action | 🟡 | some pages; several bare | §80 |
| Offline security | ➖ | none | §78 |
| Unit tests | ✅ | shared (12+28), edge (36), OCR RO (6) | §81 |
| Integration / E2E tests | ➖ | none | §82–§87 |
| i18n coverage | 🟡 | 145 keys vs many hardcoded strings | §67 |
| Tutorials on every screen | ✅ | 15 sections, web + mobile | §66 |

## 11. Priority matrix (what to build first to satisfy the spec's Phase 1 §88)

| Rank | Feature | Current | Gap size | Suggested milestone |
|---|---|---|---|---|
| 1 | Fix dashboard (`attendance_records`→`time_logs`, worker counting) | ❌ | S | R0 |
| 2 | Persist real attendance from mobile (time_logs insert) | 🧪 | S–M | R2/R4 |
| 3 | Real sync client + SQLite | ➖ | L | R4 |
| 4 | Wire mobile login | ❌ | S | R0 |
| 5 | Live `/pontaj`, `/stocuri`, `/rapoarte` | 🧪 | M | R2–R3 |
| 6 | Projects/planning/tasks engine | ➖ | L | R2+ (new) |
| 7 | Procurement (REQ/PO/delivery) | ➖ | L | R3+ (new) |
| 8 | Control Tower + drillability | ❌ | M–L | R3+ (new) |
| 9 | QA/QC + issues/NCR + change orders | ➖ | L | R5–R6 |
| 10 | Finance (budget/actual/forecast) | ➖ | L | R5–R6 |
| 11 | Commissioning + handover | ➖ | L | R6 |
| 12 | Reimbursements admin UI; invoice→stock | 🟡/➖ | M | R3/R5 |

*Deltas reference `PROJECT_AUDIT.md` §8 matrices; effort classes in `IMPLEMENTATION_ROADMAP.md`.*