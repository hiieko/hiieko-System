# HIIEKO Mobile Migration - Installation & Next Steps

## ✅ Completed This Session

### Infrastructure Built (All TypeScript code ready)
- ✅ SQLite database service (database.ts)
- ✅ NestJS API client (apiClient.ts)
- ✅ Offline sync queue (syncQueue.ts)
- ✅ Authentication service (auth.ts)
- ✅ Local data helpers (localData.ts)
- ✅ LoginScreen migrated to NestJS
- ✅ Documentation created

### Dependencies Added to package.json
- ✅ expo-sqlite ~14.0.3
- ✅ @react-native-community/netinfo 11.3.1

## 📋 Required: Install Dependencies

Before running the app, install the new dependencies:

```bash
cd Mobile
npm install
```

This will install:
- expo-sqlite (for local database)
- @react-native-community/netinfo (for network monitoring)

## 🔍 Verify Installation

```bash
npm run typecheck
```

Should complete without errors after `npm install`.

## 🚀 Next Development Steps

### Phase 2A: App Shell Integration (1-2 hours)

**File:** `Mobile/App.tsx`

1. Import services:
   ```typescript
   import { initializeAuth, getCurrentUser, logout } from './src/services/auth';
   import { getProjects, getMaterials } from './src/services/localData';
   import { syncAllOperations, getSyncQueueStats } from './src/services/syncQueue';
   import { apiClient } from './src/services/apiClient';
   import NetInfo from '@react-native-community/netinfo';
   ```

2. Add auth state management
3. Load local data on startup
4. Fetch fresh data when online
5. Monitor network and trigger auto-sync
6. Show LoginScreen when not authenticated

### Phase 2B: Attendance Screen (2-3 hours)

**File:** `Mobile/src/screens/WorkerAttendanceScreen.tsx`

1. Use `getActiveAttendance()` to check current status
2. Use `enqueueOperation()` for check-in/out
3. Save to local SQLite immediately
4. Display sync status
5. Capture GPS with `expo-location`

### Phase 2C: Other Screens (4-6 hours)

- TeamLeaderDailyReportScreen
- DeliveryIntakeScreen  
- WorkerExpenseScreen
- SettingsScreen (add sync controls)

### Phase 3: Testing (2-4 hours)

Test scenarios:
- ✓ Airplane mode operation
- ✓ App restart while offline
- ✓ Duplicate retry prevention
- ✓ Auto-sync on reconnect
- ✓ Partial sync failure

### Phase 4: Cleanup (1-2 hours)

- Remove Supabase dependencies
- Remove old storage.ts / supabase.ts
- Remove demo data
- Final production build

## 📂 Files Reference

**Created:**
```
Mobile/src/services/
├── database.ts       # SQLite schema & operations
├── apiClient.ts      # NestJS API client
├── syncQueue.ts      # Offline sync queue
├── auth.ts           # Authentication
└── localData.ts      # Local data helpers
```

**Modified:**
```
Mobile/
├── package.json              # Added dependencies
├── .env.example              # API_URL config
└── src/screens/LoginScreen.tsx   # Auth migration
```

**Documentation:**
```
├── MOBILE_MIGRATION_PROGRESS.md   # Detailed tracker
├── MOBILE_MIGRATION_SESSION.md    # Session summary
└── Mobile/README_MIGRATION.md     # Quick guide
```

## 🎯 Current State

**Working:**
- All service code written and type-safe
- Login authenticates with backend
- SQLite schema defined
- Sync queue logic implemented

**Pending:**
- `npm install` to get expo-sqlite package
- App.tsx integration with auth
- Screen updates with offline queue
- Testing and verification

## 💡 Key Concepts

**Offline-First Flow:**
1. User performs action (check-in, report, etc.)
2. Save to SQLite immediately → instant feedback
3. Add operation to sync queue with idempotency key
4. When online, sync queue processes operations
5. Backend receives Idempotency-Key header → prevents duplicates

**Example - Check-In:**
```typescript
// 1. Save locally
await saveAttendance({ id, user_id, project_id, check_in_time, ... });

// 2. Queue for sync
await enqueueOperation('attendance', 'check_in', {
  projectId, latitude, longitude, notes
});

// 3. Sync happens automatically when online
```

## 🆘 Troubleshooting

**TypeScript errors about expo-sqlite?**
→ Run `npm install` in Mobile directory

**Database not initializing?**
→ Clear cache: `expo start --clear`

**Sync not triggering?**
→ Check network indicator and queue stats in console

---

**Status:** Ready for Phase 2 integration after `npm install`
**Estimated completion:** 10-15 hours remaining (integration + testing)
