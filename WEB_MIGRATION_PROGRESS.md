# Web Application Migration Progress

**Migration Status**: In Progress  
**Started**: 2026-09-19  
**Target**: Migrate Next.js web app from Supabase to NestJS API

---

## Architecture Migration

```
BEFORE:  Next.js → Supabase (direct)
AFTER:   Next.js → NestJS API → PostgreSQL
```

---

## Core Infrastructure

### ✅ Completed

1. **API Client Layer** (`web/src/lib/api-client.ts`)
   - Typed HTTP client with auth token management
   - All major endpoints mapped (auth, projects, expenses, users, attendance, etc.)
   - Automatic token storage in localStorage
   - Error handling with ApiError class

2. **React Hooks** (`web/src/lib/useApiQuery.ts`)
   - `useApiQuery` - for GET requests with loading/error states
   - `useApiMutation` - for POST/PATCH/DELETE operations
   - Similar API to previous `useSupabaseQuery`

3. **AuthContext Migrated** (`web/src/contexts/AuthContext.tsx`)
   - Replaced Supabase Auth with JWT token auth
   - Uses API client `/api/auth/me` endpoint
   - Token-based session management
   - `refreshUser()` method for manual refresh

4. **Environment Configuration** (`web/.env.example`)
   - Added `NEXT_PUBLIC_API_URL` configuration
   - Marked Supabase vars as deprecated

---

## Page Migrations

### ✅ Authentication Pages (DONE)

- **`/login`** - Migrated to `apiClient.login()`
- **`/signup`** - Migrated to `apiClient.register()`

### 🚧 In Progress

None currently.

### ⏳ Pending (Priority Order)

1. **Users & Profiles**
   - `/utilizatori` - User list (backend: `GET /api/users`)
   - `/profil` - Profile page (backend: `PATCH /api/users/profile`)

2. **Projects (Santiere)**
   - `/santiere` - Project list (backend: `GET /api/projects`)
   - Project details (backend: `GET /api/projects/:id`)

3. **Expenses & Approvals**
   - `/cheltuieli` - Expense list (backend: `GET /api/expenses`)
   - `/aprobare` - Approval workflow (backend: `POST /api/expenses/:id/approve`)

4. **Dashboard**
   - `/` - Dashboard stats (backend: `GET /api/dashboard/stats`)

5. **Notifications**
   - `/notificari` - Notifications (backend: `GET /api/notifications`)

6. **Avize (Delivery Notes)**
   - `/avize` - Delivery notes (backend: `GET /api/procurement/avize`)

7. **Statistics**
   - `/statistici` - Stats page (backend: varies by resource)

8. **Mock Pages (Convert to Real)**
   - `/pontaj` - Attendance (backend: `GET /api/attendance`)
   - `/rapoarte` - Daily reports (backend: `GET /api/daily-reports`)
   - `/stocuri` - Stock/inventory (backend: `GET /api/inventory/stock`)

---

## Backend API Endpoints Available

### Authentication
- ✅ `POST /api/auth/register`
- ✅ `POST /api/auth/login`
- ✅ `GET /api/auth/me`

### Users
- ✅ `GET /api/users` - List users
- ✅ `GET /api/users/:id` - Get user
- ✅ `PATCH /api/users/:id/role` - Update role
- ✅ `PATCH /api/users/profile` - Update own profile

### Projects
- ✅ `GET /api/projects`
- ✅ `GET /api/projects/:id`
- ✅ `POST /api/projects`
- ✅ `PATCH /api/projects/:id`

### Expenses
- ✅ `GET /api/expenses`
- ✅ `GET /api/expenses/:id`
- ✅ `POST /api/expenses`
- ✅ `POST /api/expenses/:id/approve`

### Attendance
- ✅ `GET /api/attendance`
- ✅ `POST /api/attendance/check-in`
- ✅ `POST /api/attendance/:id/check-out`

### Materials & Inventory
- ✅ `GET /api/materials`
- ✅ `GET /api/inventory/stock`
- ✅ `GET /api/inventory/movements`

### Notifications
- ✅ `GET /api/notifications`
- ✅ `POST /api/notifications/:id/read`
- ✅ `POST /api/notifications/mark-all-read`

### Daily Reports
- ✅ `GET /api/daily-reports`
- ✅ `POST /api/daily-reports`

### Procurement (Avize)
- ✅ `GET /api/procurement/delivery-notes` (avize)
- ✅ `GET /api/procurement/delivery-notes/:id`

### Employees
- ✅ `GET /api/employees`
- ✅ `GET /api/employees/:id`
- ✅ `POST /api/employees`

---

## UI/UX Preservation Checklist

For each migrated page, verify:

- ✅ All Romanian text preserved
- ✅ Existing layouts unchanged
- ✅ Component structure maintained
- ✅ Design tokens (colors, spacing) identical
- ✅ Routes unchanged
- ✅ Loading states implemented
- ✅ Error states implemented
- ✅ Empty states implemented
- ✅ Authorization checks in place
- ✅ Pagination where needed
- ✅ Filtering where appropriate

---

## Testing Checklist

Before marking migration complete:

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] Manual testing of critical workflows:
  - [ ] Login/logout
  - [ ] User list and profile
  - [ ] Project CRUD
  - [ ] Expense submission and approval
  - [ ] Attendance check-in/out
  - [ ] Notifications
  - [ ] Dashboard stats
  - [ ] Stock movements
  - [ ] Daily reports

---

## Notes

- **Supabase dependencies remain** until all pages are migrated and verified
- **No breaking changes** to UI/UX or routes
- **API client** provides seamless drop-in replacement for Supabase calls
- **Token auth** uses JWT stored in localStorage (compatible with mobile app)

---

## Next Steps

1. Migrate `/santiere` (Projects page)
2. Migrate `/utilizatori` (Users page)
3. Migrate dashboard (`/`)
4. Continue with remaining pages in priority order
5. Final verification and testing
6. Remove Supabase dependencies
