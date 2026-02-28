# Offline PWA Capabilities — Design Document

**Date:** 2025-02-28  
**Status:** Approved

---

## 1. Overview

Enable offline workout capabilities by caching routine data and exercise videos using PWA service worker and IndexedDB. Users can work out without internet connectivity using routines they've recently used or explicitly marked for offline access.

**Key behaviors:**
- Automatically cache routines + videos when user starts a workout (14-day TTL)
- Manual "Available Offline" pin keeps routine cached indefinitely
- Master toggle in settings to enable/disable all offline features
- Storage visibility in settings and routine detail pages

---

## 2. Caching Strategy

### 2.1 What Gets Cached

| Data Type | Trigger | Storage | TTL |
|-----------|---------|---------|-----|
| Routine metadata | Workout start or manual pin | IndexedDB | 14 days (or indefinite if pinned) |
| Exercise metadata | Part of routine cache | IndexedDB | Same as parent routine |
| Exercise videos | Workout start or manual pin | IndexedDB (blobs) | Same as parent routine |
| Static assets (JS/CSS/fonts) | App load | Cache API (SW) | Until app update |
| App shell pages | App load | Cache API (SW) | NetworkFirst with fallback |

### 2.2 Lazy Caching with Persistence

- Videos are **only** downloaded when:
  1. User starts a workout (auto-cache, 14-day expiry)
  2. User toggles "Available Offline" on a routine (pinned, no expiry)
- Metadata is cached alongside videos
- Reference counting: exercises shared across routines are stored once

### 2.3 Cache Cleanup

- On app load (when online): delete expired entries (`expiresAt < now` AND `pinned === false`)
- On master toggle OFF: delete all offline data after user confirmation
- On routine unpin/remove: delete routine + orphaned exercises (not referenced by other cached routines)

---

## 3. Data Model

### 3.1 IndexedDB Schema (Dexie)

**Database version:** 2 (upgrade from 1)

```typescript
// New tables
interface CachedRoutine {
  id: string;                    // routine ID (primary key)
  userId: string;
  routine: Routine;              // full routine object with blocks
  exerciseIds: string[];         // exercise IDs in this routine
  cachedAt: number;              // timestamp
  expiresAt: number | null;      // null = pinned (indefinite)
  pinned: boolean;
  sizeBytes: number;             // total size (metadata + videos)
}

interface CachedExercise {
  id: string;                    // exercise ID (primary key)
  exercise: Exercise;            // full exercise object
  routineIds: string[];          // routines that reference this exercise
  cachedAt: number;
}

interface OfflineSettings {
  id: string;                    // 'settings' (singleton)
  enabled: boolean;
  lastCleanupAt: number;
}

// Updated table
interface CachedMedia {
  id?: number;
  url: string;
  exerciseId: string;            // NEW: link to exercise
  blob: Blob;
  sizeBytes: number;             // NEW: for storage tracking
  cachedAt: number;
}
```

**Dexie schema:**
```javascript
this.version(2).stores({
  // Existing
  pendingArchives: '++id, userId, createdAt',
  pendingMedia: '++id, userId, archiveId, createdAt',
  workoutState: '++id, workoutId, userId, updatedAt',
  // Updated
  cachedMedia: '++id, url, exerciseId, cachedAt',
  // New
  cachedRoutines: 'id, userId, expiresAt, pinned',
  cachedExercises: 'id, *routineIds',
  offlineSettings: 'id',
});
```

---

## 4. Service Worker (Serwist)

### 4.1 Setup

Use `@serwist/next` for Next.js 14 App Router integration.

**Installation:**
```bash
npm i @serwist/next
npm i -D serwist
```

**Configuration:**
- Wrap `next.config.mjs` with `withSerwist`
- Create `src/app/sw.ts` with Serwist configuration
- Add offline fallback page (`/offline`)

### 4.2 Caching Strategies

| Route Pattern | Strategy | Notes |
|---------------|----------|-------|
| `/_next/static/*` | CacheFirst | Build assets |
| `/icons/*`, `/fonts/*` | CacheFirst | Static assets |
| `/*.js`, `/*.css` | StaleWhileRevalidate | App code |
| `/api/*` | NetworkOnly | API calls (handled by app) |
| Navigation requests | NetworkFirst | Fallback to cached shell |
| Firebase Storage URLs | NetworkOnly | Handled by IndexedDB in app |

### 4.3 Offline Fallback

When offline and page not cached:
- Show `/offline` page with message: "You're offline. Cached workouts are still available."
- Provide links to cached routines (read from IndexedDB)

---

## 5. UI Components

### 5.1 Profile Tab (New)

**Route:** `/profile`

**Layout:**
- User info section (name, email from auth)
- Gear icon (⚙️) in top-right header → opens Settings sheet

**Bottom nav update:**
- Add 4th tab: Profile (user icon)
- Grid changes from `grid-cols-3` to `grid-cols-4`

### 5.2 Settings Sheet

**Component:** `SettingsSheet.tsx`

**Design:** Slide-up drawer (like Instagram settings), not full-page.

**Sections:**

```
┌─────────────────────────────────┐
│ Settings                      ✕ │
├─────────────────────────────────┤
│ OFFLINE DATA                    │
│ ┌─────────────────────────────┐ │
│ │ Using 145 MB          ────○ │ │  ← Storage + toggle
│ └─────────────────────────────┘ │
│                                 │
│ (When toggle ON:)               │
│                                 │
│ Saved for Offline               │
│ ┌─────────────────────────────┐ │
│ │ Morning Stretch    📌  [🗑] │ │  ← Pinned routine
│ │ Core Workout           [🗑] │ │  ← Auto-cached (14d)
│ │ Evening Mobility       [🗑] │ │
│ └─────────────────────────────┘ │
│                                 │
│ (When toggle OFF:)              │
│ (List hidden, toggle shows      │
│  "Enable to save workouts       │
│   for offline use")             │
└─────────────────────────────────┘
```

**Interactions:**
- **Toggle OFF → ON:** Enable offline caching
- **Toggle ON → OFF:** Show confirmation dialog, then delete all offline data
- **Tap row:** Slide row left ~60px to reveal red trash button (iOS-style)
- **Swipe left:** Same reveal behavior
- **Tap trash:** Remove routine from offline (with confirmation if pinned)

### 5.3 Routine Detail Page Update

**Add to routine detail (`/routines/[id]`):**

```
┌─────────────────────────────────┐
│ [Routine Name]                  │
│ 12 exercises · 25 min           │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ Available Offline    ────○  │ │  ← Toggle
│ │ Using 48 MB                 │ │  ← Storage (when ON)
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ [Exercise list...]              │
└─────────────────────────────────┘
```

**Behavior:**
- Toggle ON: Pin routine, start downloading videos in background
- Toggle OFF: Unpin routine (keeps in cache until 14-day expiry or cleanup)
- Show download progress while caching
- Show storage size when cached

### 5.4 Offline Indicator

**Global indicator** when `navigator.onLine === false`:
- Banner at top: "You're offline — using cached data"
- Subtle, dismissible

---

## 6. Core Logic

### 6.1 Offline Cache Manager

**File:** `src/lib/offline/cacheManager.ts`

```typescript
interface OfflineCacheManager {
  // Settings
  isEnabled(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
  
  // Routine caching
  cacheRoutine(routine: Routine, exercises: Exercise[], pin?: boolean): Promise<void>;
  uncacheRoutine(routineId: string): Promise<void>;
  pinRoutine(routineId: string, pinned: boolean): Promise<void>;
  getCachedRoutine(routineId: string): Promise<CachedRoutine | null>;
  getAllCachedRoutines(userId: string): Promise<CachedRoutine[]>;
  
  // Exercise/media
  getCachedExercise(exerciseId: string): Promise<CachedExercise | null>;
  getCachedMediaUrl(exerciseId: string): Promise<string | null>; // blob URL
  
  // Storage
  getTotalStorageUsed(): Promise<number>;
  getRoutineStorageUsed(routineId: string): Promise<number>;
  
  // Cleanup
  cleanupExpired(): Promise<void>;
  clearAllOfflineData(): Promise<void>;
}
```

### 6.2 Caching Flow (Workout Start)

```
User starts workout
       │
       ▼
Check offlineSettings.enabled
       │
       ├─ false → Skip caching
       │
       ▼ true
Check if routine already cached
       │
       ├─ yes (pinned) → Skip, use existing
       ├─ yes (not pinned) → Refresh expiresAt
       │
       ▼ no
Cache routine metadata
       │
       ▼
For each exercise in routine:
  ├─ Check if exercise cached
  │     ├─ yes → Add routineId to routineIds[]
  │     └─ no → Cache exercise metadata
  │
  ▼
  Check if video cached
        ├─ yes → Skip
        └─ no → Fetch video → Store blob in cachedMedia
       │
       ▼
Update routine.sizeBytes
       │
       ▼
Workout proceeds (videos served from cache)
```

### 6.3 Uncaching Flow

```
User removes routine from offline (or toggle OFF)
       │
       ▼
Delete cachedRoutines entry
       │
       ▼
For each exerciseId in routine.exerciseIds:
  │
  ▼
  Remove routineId from exercise.routineIds[]
  │
  ├─ routineIds[] empty? → Delete exercise + media blob
  └─ routineIds[] not empty → Keep (used by other routine)
```

### 6.4 Offline Data Hooks

**File:** `src/lib/hooks/useOfflineRoutine.ts`

```typescript
function useOfflineRoutine(routineId: string) {
  // Returns routine from IndexedDB when offline
  // Falls back to Firestore when online
}

function useOfflineExerciseMedia(exerciseId: string) {
  // Returns blob URL from IndexedDB when offline
  // Falls back to Firebase Storage URL when online
}
```

Integrate with existing `useRoutine` and `useMediaBuffer` hooks.

---

## 7. Background Sync

### 7.1 Sync Queue Enhancement

Update `processSyncQueue` to:
1. Trigger automatically on `online` event
2. Use Background Sync API where supported (Chrome/Edge)
3. Fallback to manual sync on other browsers

### 7.2 Registration

```typescript
// In service worker
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-archives') {
    event.waitUntil(processPendingArchives());
  }
  if (event.tag === 'sync-media') {
    event.waitUntil(processPendingMedia());
  }
});
```

---

## 8. Storage Management

### 8.1 Quota Estimation

Use Storage API to estimate available space:

```typescript
const estimate = await navigator.storage.estimate();
const usedMB = Math.round((estimate.usage || 0) / 1024 / 1024);
const quotaMB = Math.round((estimate.quota || 0) / 1024 / 1024);
```

### 8.2 Storage Pressure Handling

If storage is low (< 100 MB available):
- Warn user in settings
- Suggest removing unpinned routines
- Auto-cleanup oldest unpinned routines if critically low

---

## 9. Security Considerations

- Offline data stored in IndexedDB is **not encrypted**
- Videos are Firebase Storage URLs → cached blobs are accessible locally
- Master toggle OFF deletes all data (privacy control)
- No sensitive user data stored offline (auth tokens remain in memory/secure storage)

---

## 10. Implementation Checklist

### Phase 1: Infrastructure
- [ ] Install and configure Serwist for Next.js
- [ ] Create service worker (`src/app/sw.ts`)
- [ ] Add offline fallback page (`/offline`)
- [ ] Update Dexie schema to version 2
- [ ] Create `OfflineCacheManager` class

### Phase 2: Caching Logic
- [ ] Implement routine caching on workout start
- [ ] Implement video blob storage
- [ ] Implement cache cleanup logic
- [ ] Implement reference counting for shared exercises
- [ ] Add storage size tracking

### Phase 3: UI - Profile & Settings
- [ ] Add Profile tab to BottomNav
- [ ] Create `/profile` page
- [ ] Create `SettingsSheet` component
- [ ] Implement offline toggle with confirmation
- [ ] Implement swipe/tap-to-reveal delete pattern
- [ ] Add storage indicator

### Phase 4: UI - Routine Detail
- [ ] Add "Available Offline" toggle to routine detail
- [ ] Add storage size display
- [ ] Add download progress indicator

### Phase 5: Offline Hooks
- [ ] Create `useOfflineRoutine` hook
- [ ] Create `useOfflineExerciseMedia` hook
- [ ] Integrate with existing hooks (`useRoutine`, `useMediaBuffer`)
- [ ] Add offline status banner

### Phase 6: Background Sync
- [ ] Register sync events in service worker
- [ ] Trigger `processSyncQueue` on `online` event
- [ ] Add Background Sync API support (with fallback)

### Phase 7: Polish
- [ ] Test offline scenarios
- [ ] Test storage cleanup
- [ ] Test cross-routine exercise sharing
- [ ] Add error handling for failed video downloads
- [ ] Test on various browsers (Chrome, Safari, Firefox)

---

## 11. Out of Scope

- Offline routine editing (read-only offline)
- Offline exercise creation
- Selective exercise caching within a routine
- Cloud backup of offline preferences
