# HIIEKO Documents Page --- UI/UX Specification

**Project:** HIIEKO Solar Site Management System\
**Company:** Hiieko Romania SRL\
**Status:** Proposed specification; audit existing implementation before
coding\
**Scope:** Documents page UI/UX. No unapproved backend, API, database,
permission, or storage-architecture changes.

## 1. Goal

Create one dependable place to find and access authorized company and
project documents, without forcing users to navigate a large,
inconsistent folder tree.

Provide two complementary ways to browse: 1. **Library:** organized
entry points by business purpose and project/site, only where supported
by real data. 2. **Original folders:** a familiar hierarchical view that
preserves source names and paths.

The supplied folder-tree example includes project/site folders
(e.g. Bucecea 0.9 MW, Banca 2.7 MW, Dobrosloveni, Brăila), technical
plans and drawings, permits/grid-connection material, construction
progress and commissioning, contracts/offers, maintenance documents,
marketing and administration files, archives, and sensitive
HR/SSM/identity/occupational-medicine/payroll-related records. This is
evidence of existing material, not an approved taxonomy or permission to
reorganize files automatically.

## 2. Non-negotiable rules

-   First audit existing document routes, components, API clients,
    backend endpoints, storage integrations, and authorization.
-   Do not invent fields, endpoints, statuses, permissions, or
    workflows.
-   Do not use fake/local-only production data.
-   Do not automatically move, rename, delete, duplicate, or migrate
    source files.
-   Preserve original file names, source paths, and file identity
    wherever the existing integration exposes them.
-   Reuse existing backend authorization. Hiding a button is not
    security.
-   Do not show unauthorized file names, paths, previews, OCR text,
    search results, or metadata.
-   Add only actions that map to real supported backend/provider
    operations.
-   OCR/AI classification, if integrated, must be shown as a suggestion
    and reviewed before changing metadata.
-   All visible text must use the existing Romanian/English translation
    system. No mixed-language UI.
-   Preserve unrelated working-tree changes; do not commit or push
    unless explicitly requested.

## 3. Proposed information architecture

Use the existing application route and navigation conventions. Suggested
labels: **Documente** (RO) / **Documents** (EN).

### Page header

-   Compact title and short description.
-   No redundant oversized dark banner above a second title.
-   Search is prominent and the page uses space efficiently.

### Main views

-   **Library / Bibliotecă**
-   **Projects / Proiecte**
-   **Folders / Foldere**

These are proposed UI views, not assumptions that separate backend
entities already exist.

### Library view

Potential groupings, only when supported by real folders or metadata: -
Projects and site documents - Technical documentation - Permits and
grid-connection documents - Contracts and commercial documents - Offers
and procurement - Finance and invoices - Maintenance - SSM and
compliance - HR and employee documents - Administration - Marketing -
Archive

Do not present a category as a working filter unless it is backed by
actual metadata, existing folder structure, or a supported server-side
query.

### Projects view

Start from an authorized project/site and browse its associated
documents. Possible groupings, where supported by source content,
include permits/approvals, engineering drawings, construction/site
execution, progress, commissioning/handover, contracts, finance, and
other files. These are UI groupings only---not invented statuses or
database entities.

### Original folders view

-   Expand/collapse folders.
-   Show a navigable breadcrumb/current path.
-   Preserve original names and hierarchy.
-   Handle deep nesting, long names, empty folders, inaccessible
    folders, missing files, and loading errors.
-   Do not assume every folder represents a project.
-   Do not show unsupported destructive actions.

## 4. Suggested desktop layout

``` text
┌───────────────────────────────────────────────────────────────────┐
│ Documents / Documente                                              │
│ Find company and project files                                     │
├───────────────────────────────────────────────────────────────────┤
│ [ Search by file name or supported metadata...                  ]  │
├───────────────────────────────────────────────────────────────────┤
│ [Library] [Projects] [Folders]                                     │
├──────────────────────────────┬────────────────────────────────────┤
│ Categories / Folder tree     │ Documents                           │
│ Projects and sites           │ Name | Project/Folder | Type | Date │
│ Technical documentation      │ ...                                 │
│ Contracts and commercial     │ ...                                 │
│ HR and compliance            │ ...                                 │
│ Administration / Archive     │ ...                                 │
└──────────────────────────────┴────────────────────────────────────┘
```

Concept only. Use a collapsible navigation pane or mobile drawer when
required by the existing shell and screen width.

## 5. Document list and details

Use only fields exposed by the real API/provider. Where available, a row
may include: - File name and type - Project/site association - Parent
folder or source path - Modified date and size - Owner/uploader -
Source/provider - Supported actions

Do not fabricate missing values. A click must open a real supported
destination---such as an existing preview, detail page, or source file.
Do not simulate a successful open, download, upload, save, move, or
delete.

Possible actions (open, download, upload, rename, move, delete, share,
replace) must each be audited before display. A detail panel may show
file identity, source location, project/site, available metadata, and
real supported actions.

## 6. Search and filters

First confirm which fields are searchable in the current
backend/provider. Potential fields only where supported: - File/folder
name and path - Project/site - Existing document type/category -
Modified date

Requirements: - Clear labels and an obvious reset path. - Explain when
no results match the query/filter. - Do not imply full-text/OCR search
unless it is actually implemented and connected. - Do not make a
client-side subset appear to be a complete library search.

## 7. Upload and OCR

Do not add an Upload control until the audit confirms real upload
support, destination, server-side authorization, file validation,
limits, and success/error handling.

If supported, make the destination clear, display actual file limits,
show progress only when available, and confirm success only after server
confirmation. Do not silently assign a project/category.

If OCR is connected, present extracted values/classification as
suggestions, identify when review is needed, and never overwrite
original files or confirmed metadata without an explicit supported
action.

## 8. Responsive behavior

### Desktop (\>1280px)

-   Two-pane folder/category navigation and document results where
    useful.
-   Prominent search; readable columns; long names wrap or have an
    accessible way to inspect the full value.
-   Avoid excessive card grids and empty space.

### Tablet (768--1279px)

-   Narrow or collapse navigation.
-   Prevent horizontal overflow and keep supported actions reachable.

### Mobile (\<768px)

-   Single-column list.
-   Folder navigation in a drawer or separate folder-browser view.
-   File name first; secondary metadata beneath.
-   Filters in a clear panel/sheet if necessary.
-   No hover-only actions; use touch targets of at least 44px where
    practical.
-   Breadcrumbs and long paths must not break the screen.

## 9. Required states

Implement only states relevant to the real data flow: - Loading -
Populated - Empty library/folder - No search results - Error/unavailable
with retry only if supported - Access denied without leaking metadata -
Missing source file (distinguished from empty folder/network failure) -
Long-running operation, only if the backend exposes a meaningful state -
Upload/OCR/review states, only if those workflows exist

Do not invent document statuses.

## 10. Visual system

Follow the existing HIIEKO design system and shared app shell: - HIIEKO
Green `#188C51` - Solar Amber `#F59E0B` - Navy `#111827` - Context Slate
`#374151` - Canvas `#F3F4F6` - White `#FFFFFF` - Inter typography and
existing shared tokens

Keep route and project context clear. Use semantic color sparingly,
consistent spacing, accessible contrast and visible focus. Avoid
redundant banners, mixed-language labels, heavy shadows, clipped
headings, and decorative KPI cards that do not help document work.

## 11. Sensitive files and permissions

The folder tree includes sensitive-looking identity scans, employment
contracts, occupational medicine, payroll/salary amendments, leave
requests, financial records, and contracts.

-   Reuse existing server-side resource and role authorization.
-   Never infer authorization from a folder name or frontend role label
    alone.
-   If current backend permissions are missing or unclear, document the
    gap and stop before adding access-expanding behavior.
-   Do not use real sensitive document contents in demos, screenshots,
    fixtures, or tests without approval and appropriate protection.

## 12. Storage/source-of-truth decision --- unresolved

The folder tree does not establish where the authoritative files live or
how HIIEKO should access them.

During a **read-only audit**, establish: 1. Whether a Microsoft
365/OneDrive/SharePoint integration already exists. 2. Where current
files are stored and how the UI retrieves them. 3. Which real endpoints
support list, preview, download, upload, or organization. 4. How
provider IDs and source paths are represented. 5. Which server-side
permissions protect each source. 6. Whether OCR is connected to the real
application flow or is a separate service. 7. Whether files are already
referenced in multiple contexts.

Do not migrate files or choose a new storage architecture in this UI
task. If OneDrive/SharePoint is the approved source of truth, prefer
preserving it---but only after confirming the existing architecture and
business decision. If the decision remains unresolved, work only with
currently supported APIs and document limitations.

## 13. Implementation sequence

### Phase A --- read-only audit

-   Inventory document routes, pages, shared components, hooks, API
    client methods, backend endpoints, and storage adapters.
-   Trace the real data path from UI to provider.
-   List actual fields and supported operations.
-   Inspect server-side authorization.
-   Confirm localization and design-token conventions.
-   Report gaps before changing code.

### Phase B --- implementation

-   Improve the existing page using audited capabilities.
-   Reuse shared components and route conventions.
-   Implement library/project/folder views only where backed by real
    data.
-   Connect every action to a real supported operation.
-   No mock data, invented endpoints, or unsupported actions.
-   Preserve unrelated working-tree changes.

### Phase C --- verification

Run repository scripts that actually exist, including as applicable: -
`npm run i18n:check` - `npm run web:typecheck` - `npm run web:build` -
`npm run guards:check` - Relevant existing tests

Browser-check Romanian and English; desktop/tablet/mobile; populated,
empty, loading, error and denied states; real search; supported file
actions; long names/nested paths; permission boundaries; no
mixed-language labels, clipping, or horizontal overflow. Clearly record
checks that could not be performed. A passing build alone is not runtime
verification.

## 14. Acceptance criteria

-   Clear entry point to authorized documents.
-   Navigation is backed by real data, not mock records or invented
    metadata.
-   Original names and source locations remain traceable.
-   Every visible action is supported by real backend/provider behavior.
-   Sensitive files remain protected by server-side authorization.
-   Romanian and English are complete and consistent.
-   Desktop/tablet/mobile are usable.
-   Relevant loading, empty, error, missing-file, and access-denied
    states work.
-   Relevant quality checks pass and limitations are documented.
-   No unapproved backend/API/database/permission/storage changes.

## Open decision

Choose how HIIEKO accesses actual files only after the audit:

-   **Connected OneDrive/SharePoint:** use the company source if
    integration and permissions support it.
-   **HIIEKO-managed storage:** use HIIEKO storage if that is the
    approved architecture.
-   **Undecided:** audit current integrations and APIs first; do not
    implement a migration or invent a connector.
