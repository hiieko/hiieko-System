# Solar API

Documents the **actually implemented** Solar HTTP API (`backend/src/modules/solar/solar.controller.ts`). Do not assume endpoints beyond this list.

## Response envelope

The application uses two standard envelopes (set by global NestJS filters/interceptors):

- **Success**: `{ statusCode: number, data: <payload> }` (via `TransformInterceptor`).
- **Error**: `{ success: false, statusCode, code, message, details?, timestamp, path, method }` (via `AllExceptionsFilter`).

`code` is one of `UNAUTHORIZED | FORBIDDEN | NOT_FOUND | VALIDATION_ERROR | INTERNAL_ERROR`.

## Authorization (applies to every Solar route)

1. **Authentication** — `JwtAuthGuard` (class level on `SolarController`). Sets `request.user`.
2. **Role checks** — `RolesGuard` (class level) + `@Roles(...)` on write endpoints.
3. **Project isolation** — either `ProjectAccessGuard` (list/create) or `SolarDesignAccessGuard` (design-scoped routes).

**Security rule**: a user must not be able to read or mutate another project's `SolarDesign` merely by knowing its ID. `SolarDesignAccessGuard` resolves the design → `project_id` and verifies membership (Admin/Owner/PM/Manager bypass).

## Endpoints

### Designs

#### `GET /api/solar/designs?projectId=<id>` — IMPLEMENTED

- **Purpose**: list designs for one project.
- **Params**: `projectId` (query, **required** — the controller rejects a missing/empty value with 400).
- **Auth**: `JwtAuthGuard`, `RolesGuard`, `ProjectAccessGuard` (`@RequireProjectAccess('projectId')`).
- **Response `data`**: array of design rows (snake_case) with `roof_sections` and `layout_settings` included.

#### `POST /api/solar/designs` — IMPLEMENTED

- **Purpose**: create a design for a project.
- **Body**: `{ projectId: string(UUID), name: string, description?: string }`.
- **Auth**: `JwtAuthGuard`, `RolesGuard` (`ADMIN, OWNER, PM, SITE_MANAGER`), `ProjectAccessGuard`.
- **Response `data`**: the created design row.

#### `GET /api/solar/designs/:id` — IMPLEMENTED

- **Purpose**: get a design with its full working set.
- **Auth**: `JwtAuthGuard`, `RolesGuard`, `SolarDesignAccessGuard`.
- **Response `data`**: `SolarDesignModel` = `{ id, projectId, name, status, roofSections[], obstacles[], layoutSettings?, placements[] }` (roof-local mm).

### Roof sections

#### `POST /api/solar/designs/:designId/roof-sections` — IMPLEMENTED

- **Purpose**: add a surface (rectangular or arbitrary polygon).
- **Body**: `{ name: string, roofType?: string, surfaceType?: 'ROOF'|'GROUND'|'GRASS'|'GRAVEL'|'ROCK'|'ASPHALT'|'CONCRETE'|'PARKING'|'CARPORT'|'CUSTOM', slopeDeg?: number, azimuthDeg?: number, roofMaterial?: string, thicknessMm?: number, polygon: [{x,y},...], origin?: {x,y,z} }`.
- **Auth**: `JwtAuthGuard`, `RolesGuard` (`ADMIN, OWNER, PM, SITE_MANAGER`), `SolarDesignAccessGuard`.
- **Response `data`**: the created `RoofSectionModel`.

#### `GET /api/solar/designs/:designId/roof-sections` — IMPLEMENTED

- **Purpose**: list a design's roof sections.
- **Auth**: `JwtAuthGuard`, `RolesGuard`, `SolarDesignAccessGuard`.
- **Response `data`**: `RoofSectionModel[]`.

#### `PATCH /api/solar/designs/:designId/roof-sections/:roofSectionId` — IMPLEMENTED (M2)

- **Purpose**: update a roof section (name, polygon, slope/azimuth, origin, roofType).
- **Body**: `{ name?, roofType?, surfaceType?, slopeDeg?, azimuthDeg?, roofMaterial?, thicknessMm?, polygon?, origin? }`.
- **Auth**: `JwtAuthGuard`, `RolesGuard` (`ADMIN, OWNER, PM, SITE_MANAGER`), `SolarDesignAccessGuard`.
- **Validation**: `roofSectionId` must belong to `designId` (else 404); polygon must be valid (simple, ≥3 vertices, non-zero area).

#### `DELETE /api/solar/designs/:designId/roof-sections/:roofSectionId` — IMPLEMENTED (M2)

- **Purpose**: delete a roof section (cascade deletes its obstacles/placements).
- **Auth**: `JwtAuthGuard`, `RolesGuard` (`ADMIN, OWNER, PM, SITE_MANAGER`), `SolarDesignAccessGuard`.

### Obstacles

#### `POST /api/solar/designs/:designId/roof-sections/:roofSectionId/obstacles` — IMPLEMENTED (M2)

- **Purpose**: add an obstacle (skylight, chimney, vent, service area…) to a roof section.
- **Body**: `{ name?, obstacleType?, polygon: [{x,y},...], keepoutMarginMm? }`.
- **Auth**: `JwtAuthGuard`, `RolesGuard` (`ADMIN, OWNER, PM, SITE_MANAGER`), `SolarDesignAccessGuard`.
- **Validation**: polygon valid (simple, ≥3 vertices, non-zero area) and fully contained within the parent roof section (else 400).

#### `GET /api/solar/designs/:designId/roof-sections/:roofSectionId/obstacles` — IMPLEMENTED (M2)

- **Purpose**: list a roof section's obstacles.
- **Auth**: `JwtAuthGuard`, `RolesGuard`, `SolarDesignAccessGuard`.

#### `PATCH /api/solar/designs/:designId/obstacles/:obstacleId` — IMPLEMENTED (M2)

- **Purpose**: update an obstacle.
- **Body**: `{ name?, obstacleType?, polygon?, keepoutMarginMm? }`.
- **Auth**: `JwtAuthGuard`, `RolesGuard` (`ADMIN, OWNER, PM, SITE_MANAGER`), `SolarDesignAccessGuard`.
- **Validation**: `obstacleId` must belong to `designId` (else 404); polygon valid and contained within the parent roof (when provided).

#### `DELETE /api/solar/designs/:designId/obstacles/:obstacleId` — IMPLEMENTED (M2)

- **Purpose**: delete an obstacle.
- **Auth**: `JwtAuthGuard`, `RolesGuard` (`ADMIN, OWNER, PM, SITE_MANAGER`), `SolarDesignAccessGuard`.

### Layout

#### `PUT /api/solar/designs/:designId/layout-settings` — IMPLEMENTED

- **Purpose**: upsert layout settings.
- **Body**: `{ moduleSpecId?: string, orientation?: 'PORTRAIT'|'LANDSCAPE', edgeMarginMm?: number, rowSpacingMm?: number, columnSpacingMm?: number }`.
- **Auth**: `JwtAuthGuard`, `RolesGuard` (`ADMIN, OWNER, PM, SITE_MANAGER`), `SolarDesignAccessGuard`.
- **Response `data`**: the upserted `LayoutSettingsModel`.

#### `POST /api/solar/designs/:designId/layout/calculate` — IMPLEMENTED

- **Purpose**: compute the module layout (roof-local placements) and persist it.
- **Auth**: `JwtAuthGuard`, `RolesGuard`, `SolarDesignAccessGuard`.
- **Response `data`**: `{ placements: ModulePlacement[], mounting: MountingResult, bom: BomLine[], totalModules: number, totalPowerWp: number }`.

### Placements

#### `PUT /api/solar/designs/:designId/placements` — IMPLEMENTED (Phase H)

- **Purpose**: bulk-replace all module placements (the persistence boundary for the interactive 2D editor: move/rotate/duplicate/delete).
- **Body**: `{ placements: ModulePlacementDto[] }` (each: `id`, `roofSectionId`, `moduleSpecId?`, `row`, `column`, `localX`, `localY`, `localZ`, `rotationDeg`, `widthMm`, `heightMm`).
- **Auth**: `JwtAuthGuard`, `RolesGuard` (`ADMIN, OWNER, PM, SITE_MANAGER`), `SolarDesignAccessGuard`.
- **Validation**: every placement's `roofSectionId` must belong to `designId` (else 400); transactional `deleteMany` + `createMany`.
- **Response `data`**: `{ id: string, count: number }`.

### BOM

#### `GET /api/solar/designs/:designId/bom` — IMPLEMENTED

- **Purpose**: compute the prototype BOM (not persisted as a snapshot).
- **Auth**: `JwtAuthGuard`, `RolesGuard`, `SolarDesignAccessGuard`.
- **Response `data`**: same shape as `layout/calculate` (`{ placements, mounting, bom, totalModules, totalPowerWp }`).

### Catalog

#### `GET /api/solar/modules` — IMPLEMENTED

- **Purpose**: list active PV module specs.
- **Auth**: `JwtAuthGuard`, `RolesGuard`.
- **Response `data`**: `ModuleSpecModel[]`.

#### `GET /api/solar/products` — IMPLEMENTED

- **Purpose**: list active mounting products.
- **Auth**: `JwtAuthGuard`, `RolesGuard`.
- **Response `data`**: `SolarProduct[]` rows (snake_case).

## Reserved / deferred (NOT implemented)

These are in the roadmap but have **no** controller routes yet:

- `GET/POST /api/solar/designs/:id/versions` (revisions/snapshots)
- `POST /api/solar/designs/:id/versions/:vid/restore`
- Product/module **manage** endpoints (`POST /api/solar/products`, `POST /api/solar/modules`)
- `POST /api/solar/designs/:id/mounting/calculate`
- `GET /api/solar/mounting-families`

## Key authorization requirements (summary)

- **Design listing requires `projectId`**; a missing `projectId` is rejected (400), and the requested project must be accessible to the caller (`ProjectAccessGuard`).
- **Design-scoped operations** (`GET :id`, roof, layout, BOM) enforce `SolarDesignAccessGuard`, which blocks access to a design belonging to a project the caller is not a member of (unless Admin/Owner/PM/Manager).
