# HIIEKO Mobile App - Offline-First

## Architecture

```
React Native + Expo → SQLite → Sync Queue → API Client → NestJS Backend
```

**Offline-First**: All operations work without network. Data syncs automatically when online.

## Key Services

- **database.ts** - SQLite storage (user, projects, attendance, reports, sync queue)
- **apiClient.ts** - NestJS API communication with JWT auth
- **syncQueue.ts** - Operation queue with idempotency & retry logic
- **auth.ts** - Login/logout, token management
- **localData.ts** - Helper functions for local data access

## Setup

```bash
cd Mobile
npm install

# Configure environment
cp .env.example .env
# Edit .env: EXPO_PUBLIC_API_URL=http://localhost:4000

npm start
```

## Features

✅ **Offline Operation** - Check-in, reports, expenses work without network  
✅ **Auto-Sync** - Syncs when connection restored  
✅ **Idempotency** - Retries don't create duplicates  
✅ **GPS Evidence** - Location captured and validated by backend  
✅ **Photo Queue** - Images queued for upload when online  

## Testing Offline

1. Enable airplane mode
2. Perform operations (check-in, report, etc.)
3. Verify data saved locally
4. Restart app (still offline)
5. Disable airplane mode
6. Verify auto-sync completes

## Migration Status

✅ Infrastructure complete (database, API, sync queue, auth)  
🔄 Screen integration in progress  
⏳ Testing pending  

See `MOBILE_MIGRATION_PROGRESS.md` for details.

---

**Last Updated:** 2026-09-19
