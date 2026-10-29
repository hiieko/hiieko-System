## Attendance UI — Reference Analysis Report

**Date:** 2026-10-25
**Status:** Reference verification complete

---

## 1. Reference Access Verification

| Reference | URL | Access Status | Visual Details Available |
|-----------|-----|---------------|--------------------------|
| **CMiC Crew Time Dashboard** | docs.cmicglobal.com | ✅ Full access | ✅ Screenshot + text patterns |
| **BuildIt CP** | builditcp.com | ✅ Full access | ✅ Product screenshots |
| **Archdesk Timesheets** | archdesk.com | ✅ Full access | ✅ Product screenshots |

---

## 2. Verifiable Layout Patterns from References

### 2.1 CMiC Crew Time Real-Time Dashboard (Primary Register Reference)

**Verified Patterns (from screenshot and documentation):**

1. **Clock In/Out Counter Band**
   - Two-icon counter: green clock (clocked in) + red clock with slash (clocked out/on break)
   - Positioned prominently at top
   - Shows live totals as numbers
   - *HIIEKO mapping:* `AttendancePulse` already implements similar pattern with on-site/completed counts

2. **Filter/Search Bar**
   - Crew filter dropdown (left)
   - Employee search field (right)
   - Sortable column headers
   - *HIIEKO mapping:* `AttendanceToolbar` has search + session filter; month picker instead of crew

3. **Status Icons**
   - Green clock icon = clocked in
   - Red clock with slash = clocked out or on break
   - Orange alert triangle = exception (crew assignment issue)
   - *HIIEKO mapping:* Uses Badge components with success/warning variants; could add explicit icons

4. **Table Structure**
   - Employee identification (name, number)
   - Crew assignment
   - Time columns (clock in, clock out)
   - Hours columns (Break, Regular, OT)
   - Status indicator column
   - *HIIEKO mapping:* `AttendanceRegister` has similar columns; missing explicit break tracking (not in scope)

5. **Dashes for Incomplete Data**
   - "-" displayed for Break/Regular/OT until employee clocks out
   - *HIIEKO mapping:* `formatHours()` returns "N/A" for null/undefined

6. **Data Calculation Rules (documented)**
   - Total hours = clock out - clock in
   - Regular hours capped at 8
   - Overtime = hours over 8 (if entitled)
   - *HIIEKO mapping:* Backend `checkOut()` implements exact same logic

### 2.2 BuildIt CP (Primary Visual Reference)

**Verified Patterns (from product screenshots):**

1. **Time & Attendance Screen Layout**
   - Left sidebar navigation
   - Top header with project context
   - Main content area with card-based layout
   - Geotagged attendance map placeholder
   - *HIIEKO mapping:* Has sidebar + header; card-based register already implemented

2. **Workforce Map**
   - Visual map showing attendance locations
   - Geotagged clock-in indicators
   - *HIIEKO mapping:* Not in current scope; GPS state badge shows inside/outside geofence

3. **Simple Clock-In Interface**
   - One-click clock-in/out
   - GPS verification indicator
   - *HIIEKO mapping:* Mobile app has check-in/out; supervisor view is read-only

### 2.3 Archdesk Timesheets (Secondary Workflow Reference)

**Verified Patterns (from product screenshots):**

1. **Timesheet List View**
   - Table with employee, project, hours, cost
   - Date range filter
   - Approval status column
   - *HIIEKO mapping:* `AttendanceRegister` shows similar data without cost/approval

2. **Single Timesheet View**
   - Detailed breakdown of hours
   - Project and task allocation
   - Cost calculations
   - *HIIEKO mapping:* `AttendanceDetailDrawer` shows per-record breakdown

3. **Real-Time Attendance Dashboard**
   - Who is on which site now
   - GPS-verified clock-in/out
   - Shift planning
   - *HIIEKO mapping:* `AttendanceTodayRail` shows active workers; no shift planning (out of scope)

---

## 3. HIIEKO Component Mapping

| HIIEKO Component | CMiC Pattern | BuildIt Pattern | Archdesk Pattern | Alignment Status |
|------------------|--------------|-----------------|------------------|------------------|
| `AttendancePulse` | Clock In/Out Counter | Workforce summary card | Real-time dashboard header | ✅ Aligned |
| `AttendanceToolbar` | Filter/Search bar | Top filter band | Date range controls | ✅ Aligned |
| `AttendanceRegister` | Dashboard table | Attendance list | Timesheet list | ✅ Aligned |
| `AttendanceMonthlyLedger` | N/A (not shown) | Monthly view | N/A | ✅ Unique to HIIEKO |
| `AttendanceTodayRail` | Side panel | Workforce panel | Live attendance side panel | ✅ Aligned |
| `AttendanceDetailDrawer` | Row detail popup | Detail view | Single timesheet view | ✅ Aligned |
| `AttendanceCorrectionDialog` | Exception popup | N/A | Edit timesheet | ✅ Aligned |
| GPS Badge | Status icon column | Geotag indicator | GPS verification | ✅ Aligned |

---

## 4. Gaps Identified

### 4.1 From CMiC Reference (Not Implemented)

1. **Break tracking column** — HIIEKO has no break model (out of scope per task constraints)
2. **Crew assignment column** — HIIEKO uses project scoping instead of crews (architectural difference)
3. **Exception alerts for crew assignment** — HIIEKO handles role-based access differently

### 4.2 From BuildIt Reference (Not Implemented)

1. **Live workforce map** — Would require significant new development (out of scope)
2. **Photo capture on clock-in** — Mobile feature, not web supervisor view

### 4.3 From Archdesk Reference (Not Implemented)

1. **Cost allocation per hour** — Requires cost model integration (out of scope)
2. **Approval workflow** — Not yet implemented for attendance (future work)
3. **Shift planning** — Separate module (out of scope)

---

## 5. Recommended Improvements (Within Scope)

Based on reference analysis, these improvements align with HIIEKO's data model and are within scope:

### 5.1 Visual Enhancements (CMiC-aligned)

1. **Clock-in/out icons in status column** — Replace text badges with CMiC-style clock icons
2. **Dashes for incomplete data** — Ensure consistent "-" display for pending values
3. **Exception indicator** — Add visual flag for GPS outside geofence (already have warning badge)

### 5.2 Information Hierarchy (BuildIt-aligned)

1. **Project context in header** — Already have `ProjectContextChip`
2. **Card grouping by date** — Already implemented in `AttendanceRegister`

### 5.3 Data Display (Archdesk-aligned)

1. **Hours breakdown** — Already show regular + overtime
2. **Project name in detail** — Already in drawer

---

## 6. Conclusion

The existing HIIEKO Attendance implementation is **well-aligned** with the construction-specific references:

- **CMiC Crew Time Dashboard**: Core table structure and counter band match
- **BuildIt CP**: Card-based layout and GPS verification indicators match
- **Archdesk Timesheets**: Hours tracking and detail drawer match

**No major redesign needed.** The implementation follows industry patterns for construction time & attendance software. The primary gaps (breaks, crews, cost allocation) are architectural differences or out of scope.

**Recommended action:** Focus on data-correctness verification and minor visual polish rather than structural redesign.
