# Dependencies

Last Updated: 2026-09-18

## Runtime Dependencies — `shared` (workspace `@solar/shared`)
| Package | Version | Purpose | Production |
|---|---|---|---|
| typescript | ^5.4.5 | Type check + `dist` build | No (build-time) |
| (no runtime deps) | — | Pure domain package | — |

## Runtime Dependencies — `web` (`@solar/web`, Next.js 14)
| Package | Version | Purpose | Production |
|---|---|---|---|
| next | 14.2.4 | Web framework | Yes |
| react / react-dom | ^18.3.1 | UI | Yes |
| @supabase/supabase-js | ^2.43.4 | Data + auth | Yes |
| tailwindcss | ^3.4.4 | Styling | Yes |
| lucide-react | — | Icons | Yes |
| clsx / tailwind-merge | — | Class joining | Yes |
| date-fns | — | Dates | Yes |
| @solar/shared | workspace | Domain logic | Yes (built `dist`) |

## Runtime Dependencies — `Mobile` (`@solar/mobile`, Expo 51 / RN 0.74)
| Package | Version | Purpose | Production |
|---|---|---|---|
| react / react-native | 18.2.0 / 0.74.2 | UI | Yes |
| expo | ~51.0.39 | Runtime | Yes |
| expo-camera | — | Receipt capture | Yes |
| expo-location | — | Geofence GPS | Yes |
| expo-image-manipulator | — | Crop/rotate receipt | Yes |
| @react-native-async-storage/async-storage | ^1.23.1 | Offline queue + settings | Yes |
| @supabase/supabase-js | ^2 | Data + auth | Yes |
| @solar/shared | workspace | Domain logic | Yes (built `dist`) |

## Runtime Dependencies — `ocr-service` (FastAPI + PaddleOCR)
| Package | Version | Purpose | Production |
|---|---|---|---|
| fastapi / uvicorn[standard] | — | HTTP service | Yes |
| pydantic | — | Schemas | Yes |
| opencv-headless | — | Image ops | Yes |
| paddlepaddle | >=3,<4 | Paddle runtime | Yes |
| paddleocr | >=3,<4 | OCR models (PP-OCRv6) | Yes |
| PyMuPDF | — | PDF input | Yes |
| lxml | — | e-Factura XML | Yes |
| python-multipart | — | Uploads | Yes |

## Development Dependencies
| Package | Version | Purpose |
|---|---|---|
| typescript | ^5.4.5 | shared/web/mobile type checking |
| tsx | (transitive/dev) | Run TS tests/scripts |
| deno | 2.x (edge runtime) | Edge Function deploy/tests |
| pytest | (missing — ISSUE-007) | OCR service tests |
| in-repo assert helpers | — | shared domain tests (`*.test.ts`) |

## System Requirements
| Requirement | Version | Required |
|---|---|---|
| OS | Windows/macOS/Linux | Yes |
| Runtime | Node.js 20 LTS (24.x present; likely fine) | Yes |
| Database | Supabase (PostgreSQL 15) | Yes (remote) |
| Package Manager | npm 10/11+ (workspaces) | Yes |
| OCR runtime | Python 3.12+ + PaddlePaddle 3.x (Docker/Linux recommended) | Yes |
| Edge runtime | Deno 2 (via `supabase functions`) | Yes |
| Container runtime | Docker (ocr-service image) | Yes |

# Installation
- Web + mobile + shared: `npm install` at the repository root (npm workspaces resolve `@solar/shared`; build it first with `npm run build -w shared`).
- OCR service: `pip install -r ocr-service/requirements.txt` in a Python 3.12+ venv, or `docker build -t hiieko-ocr ocr-service/` (Linux recommended for Paddle).
- Supabase CLI: install via npm/npx; `supabase login`, then `supabase functions deploy ocr-extract`.
Full runbook in `HOW_TO_RUN.md`.

# Dependency Changes
| Date | Package | Change | Reason |
|---|---|---|---|
| 2026-09-18 | all | Baseline survey recorded | Documentation regeneration from audit |

# Dependency Verification
Last checked: 2026-09-18

Commands:
```text
npm install            # root (workspaces) — NOT YET RUN in this environment
npm run typecheck -w web
```

Result:
NOT VERIFIED — no `node_modules` present in this checkout.

# Important Notes
Do not store secrets here. Keep versions synchronized with `package.json`, `package-lock.json`, and `ocr-service/requirements.txt`. The root dependency `@supabase/server` is unused by any imported source — see ISSUES.md (Questions Requiring Decisions).
