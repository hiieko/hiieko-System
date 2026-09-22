# HIIEKO MOBILE OFFLINE MIGRATION - PROGRESS

**Migration Status:** Phase 1 - Infrastructure Complete, Phase 2 - Integration In Progress

## Completed ✅

### 1. Dependencies
- ✅ Added `expo-sqlite` ~14.0.3 to package.json

### 2. Core Infrastructure
- ✅ **database.ts** - SQLite database service with tables:
  - user, projects, tasks, attendance, daily_reports
  - material_consumption, issues, pending_uploads, sync_queue, materials
  - Indices for performance optimization
  - Stats and clear functions

- ✅ **apiClient.ts** - NestJS API communication layer:
  - Authentication (login, getMe)
  - Projects (getProjects, getProject)
  - Attendance (checkIn, checkOut, getAttendanceRecords)
  - Daily Reports (create, list)
  - Materials & Inventory (getMaterials, recordMaterialConsumption)
  - Expenses (create, list)
  - Notifications (list, markRead)
  - File Upload support
  - Idempotency key headers for retry safety

- ✅ **syncQueue.ts** - Offline sync queue management:
  - Enqueue operations with idempotency
  - Get pending operations
  - Sync individual operations by entity type
  - Retry logic with max 5 attempts
  - Status tracking (pending, syncing, synced, failed, conflict)
  - Statistics

- ✅ **auth.ts** - Authentication service:
  - Login with email/password
  - Logout with cleanup
  - Token management (AsyncStorage + SQLite)
  - getCurrentUser, getStoredToken
  - initializeAuth for app startup
  - Save/load user from database

- ✅ **localData.ts** - Local data persistence:
  - Projects: save, get, getById
  - Materials: save, get
  - Attendance: save, getActive, getHistory
  - All with SQLite storage

### 3. UI Updates
- ✅ **LoginScreen.tsx** - Migrated from Supabase to NestJS:
  - Uses auth.ts service
  - Real authentication flow
  - Removed demo fallback
  - Clean error handling

## In Progress 🔄

### 4. App.tsx Integration
- Need to integrate auth initialization
- Replace demo data with real API calls
- Add network monitoring
- Add sync trigger on connectivity restore
- Wire up all screens with real data

## Next Steps 📋

### Phase 2: Screen Integration (Current)
1. **Update App.tsx:**
   - Initialize auth on startup
   - Load projects/materials from local DB
   - Fetch fresh data when online
   - Monitor network connectivity
   - Auto-sync when coming back online
   - Pass real data to screens

2. **Update WorkerAttendanceScreen:**
   - Use localData.ts for active attendance
   - Enqueue check-in/out to syncQueue
   - Store GPS coordinates
   - Save to local SQLite immediately
   - Display sync status

3. **Update TeamLeaderDailyReportScreen:**
   - Load projects and materials from local DB
   - Enqueue report submission to syncQueue
   - Handle photos (pending_uploads table)
   - Offline-first workflow

4. **Update DeliveryIntakeScreen:**
   - Load materials from local DB
   - Enqueue delivery notes to syncQueue
   - OCR integration with offline queue

5. **Update WorkerExpenseScreen:**
   - Enqueue expense creation
   - Handle receipt photos
   - Upload queue for attachments

### Phase 3: File Upload Queue
1. Create file upload service
2. Queue photos/documents separately
3. Upload when online with retry
4. Associate with parent entities

### Phase 4: GPS Validation
1. Backend endpoint for geofence validation
2. Mobile sends location with check-in
3. Server validates and returns result
4. Mobile displays validation status

### Phase 5: Testing
- [ ] Test airplane mode scenarios
- [ ] Test app restart while offline
- [ ] Test queue persistence
- [ ] Test duplicate retry prevention (idempotency)
- [ ] Test conflict resolution
- [ ] Test reconnect and sync
- [ ] Test partial upload failures
- [ ] Test failed upload recovery

### Phase 6: Cleanup
- [ ] Remove old Supabase dependencies
- [ ] Remove old storage.ts (replaced by database.ts)
- [ ] Update SettingsScreen with sync controls
- [ ] Add database stats to SettingsScreen

## Architecture

```
React Native + Expo
       │
   SQLite (local cache)
       │
  Sync Queue (operations)
       │
   API Client (fetch wrapper)
       │
     HTTPS
       │
   NestJS API
```

## Key Features

### Idempotency
- Every operation has unique idempotency key
- Retries don't create duplicates
- Server enforces via Idempotency-Key header

### Offline-First
- All operations work offline
- Data saved to SQLite immediately
- Queue tracks pending operations
- Auto-sync when online

### Retry Logic
- Max 5 retries per operation
- Exponential backoff (todo)
- Failed operations marked for review

### GPS Evidence
- Location captured at check-in/out
- Backend validates geofence
- Mobile displays result
- Location is evidence, not authority

## Environment Variables

Mobile app needs:
```
EXPO_PUBLIC_API_URL=http://localhost:4000
```

## Files Created/Modified

**Created:**
- Mobile/src/services/database.ts
- Mobile/src/services/apiClient.ts
- Mobile/src/services/syncQueue.ts
- Mobile/src/services/auth.ts
- Mobile/src/services/localData.ts

**Modified:**
- Mobile/package.json (added expo-sqlite)
- Mobile/src/screens/LoginScreen.tsx (auth migration)

**To Modify:**
- Mobile/App.tsx (auth + data integration)
- Mobile/src/screens/WorkerAttendanceScreen.tsx
- Mobile/src/screens/TeamLeaderDailyReportScreen.tsx
- Mobile/src/screens/DeliveryIntakeScreen.tsx
- Mobile/src/screens/WorkerExpenseScreen.tsx
- Mobile/src/screens/SettingsScreen.tsx

**To Remove:**
- Mobile/src/services/supabase.ts (after full migration)
- Demo data constants in App.tsx

---

**Last Updated:** 2026-09-19
**Status:** Infrastructure complete, proceeding with screen integration
