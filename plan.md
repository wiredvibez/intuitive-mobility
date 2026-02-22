# Intuitive Mobility - Product Requirements Document (PRD)
## Version 2.0 - Complete Specification

---

## 1. Executive Summary

**Product Name:** Intuitive Mobility

**Product Type:** Mobile-first web application for personal workout creation and execution

**Target Users:** Individual fitness enthusiasts building and executing their own workout routines

**Core Value Proposition:** Enable users to create atomic exercises, assemble them into structured routines, and execute workouts through an interactive, offline-capable live player with real-time progress tracking and memory capture.

**Design Philosophy:** Instagram-inspired aesthetic — compact, fluid, intuitive. Every interaction should feel natural and considered. The UI must avoid generic "AI-built" patterns: no excessive whitespace, no over-explained copy, no cookie-cutter component layouts. Prioritize gesture-based interactions, smooth animations, and visual density that respects the user's intelligence.

---

## 2. Technical Architecture

### 2.1 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend Framework** | React 18+ + Next.js 14+ (App Router) | Server components, streaming, optimal mobile performance |
| **State Management** | Zustand | Lightweight, minimal boilerplate, ideal for transient player state |
| **Offline Storage** | IndexedDB (via Dexie.js) | Structured local storage for offline workout execution |
| **Backend Services** | Firebase | Unified auth, database, storage ecosystem |
| **Authentication** | Firebase Auth (Google OAuth only) | Single sign-on, no password management complexity |
| **Database** | Cloud Firestore | Real-time sync, offline persistence, hierarchical queries |
| **Media Storage** | Firebase Cloud Storage | User-uploaded exercise media and workout memories |
| **Styling** | Tailwind CSS | Utility-first, rapid iteration, consistent spacing |
| **Animations** | Framer Motion | Gesture handling, spring physics, drag-and-drop |
| **Client Media Processing** | HTML5 Video/Canvas API | Native browser video trimming, no external dependencies |
| **PWA** | next-pwa | Service worker, installable app, offline shell |

### 2.2 Platform Optimization

**Primary Target:** Mobile web browsers (iOS Safari, Android Chrome)

**Responsive Strategy:**
- Mobile-first CSS breakpoints
- Touch-optimized hit targets (minimum 44x44px)
- Gesture-first interactions (swipe, drag, long-press)
- Bottom-anchored primary actions (thumb-zone optimization)
- No hover-dependent UI patterns

**Desktop:** Functional but not optimized — constrained max-width container, centered layout

### 2.3 Data Architecture (Firestore Schema)

```
├── users/{userId}
│   ├── id: string
│   ├── name: string
│   ├── email: string
│   ├── phone: string (Israeli format: +972...)
│   ├── referral_source: "yair" | "friend" | "social_media" | "other"
│   ├── referral_source_other: string (if referral_source == "other")
│   ├── preferences: object
│   ├── createdAt: timestamp
│   │
│   ├── routines/{routineId}  [SUBCOLLECTION]
│   │   ├── id: string
│   │   ├── name: string
│   │   ├── blocks: array<ExerciseBlock | BreakBlock | LoopBlock>
│   │   ├── prep_time_secs: number (default: 15)
│   │   ├── cooldown_time_secs: number (default: 15)
│   │   ├── total_duration_secs: number (computed)
│   │   ├── createdAt: timestamp
│   │   └── updatedAt: timestamp
│   │
│   ├── workouts/{workoutId}  [SUBCOLLECTION - Active Sessions]
│   │   ├── id: string
│   │   ├── routine_id: string
│   │   ├── custom_name: string (user-editable)
│   │   ├── state: "active" | "paused"
│   │   ├── last_active_timestamp: timestamp
│   │   ├── progress_index: number
│   │   ├── current_block_remaining_secs: number
│   │   ├── modifications: array<{block_index, added_time}>
│   │   └── skipped_blocks: array<number>
│   │
│   └── archive/{archiveId}  [SUBCOLLECTION - Completed Workouts]
│       ├── id: string
│       ├── workout_id: string
│       ├── routine_id: string
│       ├── routine_name: string
│       ├── custom_name: string (e.g., "Lior and Yair at the beach")
│       ├── completed_at: timestamp
│       ├── completion_type: "completed" | "auto_completed"
│       ├── total_duration_secs: number
│       ├── blocks_completed: array<CompletedBlock>
│       ├── modifications_applied: boolean
│       ├── memory_media: array<{url: string, type: "photo" | "video"}>
│       └── memory_media_paths: array<string> (storage paths for cleanup)
│
└── exercises/{exerciseId}  [ROOT COLLECTION]
    ├── id: string
    ├── author_id: string
    ├── name: string
    ├── description: string (text explanation of how to perform)
    ├── type: "repeat" | "timed"
    ├── default_time_per_rep_secs: number (required if type="repeat")
    ├── media_url: string
    ├── media_type: "video" | "gif" | "photo"
    ├── chips: array<string>
    ├── is_public: boolean
    ├── createdAt: timestamp
    └── updatedAt: timestamp
```

#### Block Type Definitions

```typescript
interface ExerciseBlock {
  id: string; // Unique within routine for drag-drop tracking
  type: "exercise";
  exercise_id: string;
  exercise_name: string;
  exercise_description: string;
  media_url: string;
  media_type: "video" | "gif" | "photo";
  exercise_type: "repeat" | "timed";
  duration_secs: number;
  reps?: number; // If repeat type
}

interface BreakBlock {
  id: string;
  type: "break";
  duration_secs: number; // Default: 15
}

interface LoopBlock {
  id: string;
  type: "loop";
  iterations: number;
  blocks: array<ExerciseBlock | BreakBlock>;
}

interface CompletedBlock {
  block_index: number;
  block_id: string;
  type: "exercise" | "break" | "prep" | "cooldown";
  exercise_id?: string;
  exercise_name?: string;
  planned_duration_secs: number;
  actual_duration_secs: number;
  skipped: boolean;
  time_added_secs: number;
}
```

---

## 3. Feature Specifications

### 3.1 Authentication & Onboarding

#### 3.1.1 Sign In Screen

```
┌─────────────────────────────────────┐
│                                     │
│           INTUITIVE                 │
│           MOBILITY                  │
│                                     │
│      ┌─────────────────────────┐   │
│      │  G  Continue with Google │   │
│      └─────────────────────────┘   │
│                                     │
│      By continuing, you agree to    │
│      our Terms and Privacy Policy   │
│                                     │
└─────────────────────────────────────┘
```

**Behavior:**
- Single authentication method: Google OAuth via Firebase Auth
- On first sign-in: Redirect to onboarding flow
- On returning sign-in: Skip to dashboard

#### 3.1.2 Onboarding Flow

```
┌─────────────────────────────────────┐
│  ←                          1 of 2  │
├─────────────────────────────────────┤
│                                     │
│  What should we call you?           │
│  ┌─────────────────────────────┐   │
│  │ Your name                    │   │
│  └─────────────────────────────┘   │
│                                     │
│  Phone number                       │
│  ┌────┬────────────────────────┐   │
│  │+972│ 50-123-4567            │   │
│  └────┴────────────────────────┘   │
│                                     │
│                                     │
│                                     │
│      ┌─────────────────────────┐   │
│      │        Continue          │   │
│      └─────────────────────────┘   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  ←                          2 of 2  │
├─────────────────────────────────────┤
│                                     │
│  How did you hear about us?         │
│                                     │
│  ○ From Yair                        │
│  ○ From a friend                    │
│  ○ From Social Media                │
│  ○ Other                            │
│    ┌───────────────────────────┐   │
│    │ Tell us more...           │   │ ← Only visible if "Other" selected
│    └───────────────────────────┘   │
│                                     │
│                                     │
│      ┌─────────────────────────┐   │
│      │      Get Started         │   │
│      └─────────────────────────┘   │
└─────────────────────────────────────┘
```

**Phone Input:**
- Israeli format only: +972 prefix locked
- Auto-format as user types (XX-XXX-XXXX)
- Validation: 9-10 digits after country code

**Referral Source:**
- Radio button selection (single choice)
- "Other" reveals inline text input below it
- Required field before proceeding

---

### 3.2 Exercise Management

#### 3.2.1 Exercise Creation

**Input Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Name | Text | Yes | Max 60 characters |
| Description | Textarea | No | How to perform the exercise, tips, form cues |
| Type | Toggle | Yes | "Repeat" or "Timed" |
| Default Time Per Rep | Number (seconds) | If repeat | e.g., Pushup = 2s/rep |
| Chips/Tags | Multi-select pills | No | Tap to add/remove |
| Privacy | Toggle | Yes | "Private" / "Public" |
| Media | Upload | Yes | Video, GIF, or Photo |

**Media Upload Rules:**
- Accepted formats: MP4, WebM, MOV, GIF, PNG, JPG, HEIC
- **Video constraint: Maximum 10 seconds**
- If uploaded video > 10 seconds → trigger Video Trimmer

#### 3.2.2 Video Trimmer

**Trigger:** User selects video file exceeding 10 seconds

**UI Design (Instagram-style):**

```
┌─────────────────────────────────────┐
│  ✕                    Trim Video    │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │                             │   │
│  │      LOOPING PREVIEW        │   │
│  │      (Selected 10s clip)    │   │
│  │                             │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░│   │
│  │◄════════►                   │   │
│  │  ↔ drag to select 10s      │   │
│  └─────────────────────────────┘   │
│  0:00                        2:45   │
│                                     │
│      ┌─────────────────────────┐   │
│      │         Done             │   │
│      └─────────────────────────┘   │
└─────────────────────────────────────┘
```

**Interaction:**
- Timeline shows full video as filmstrip thumbnails
- Highlighted selection window (10s) can be dragged horizontally
- Preview loops the selected segment in real-time
- Touch-optimized: large drag handles, momentum scrolling
- Pinch-to-zoom on timeline for precision (optional enhancement)

**Technical Implementation:**
- HTML5 `<video>` element for playback
- `<canvas>` for frame extraction and re-encoding
- Output: Trimmed video blob uploaded to Firebase Storage

#### 3.2.3 Exercise Discovery

**"Pick Exercise" Interface:**

```
┌─────────────────────────────────────┐
│  ✕              Pick Exercise       │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ 🔍 Search...                 │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Core] [Arms] [Legs] [Cardio]     │
│  [Stretch] [Balance] [+ More]       │
│                                     │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐       │
│  │ 🎬 │ │ 🎬 │ │ 🎬 │ │ 🎬 │       │
│  │Push│ │Squa│ │Plan│ │Burp│       │
│  │ups │ │ts  │ │k   │ │ees │       │
│  └────┘ └────┘ └────┘ └────┘       │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐       │
│  │ 🎬 │ │ 🎬 │ │ 🎬 │ │ 🎬 │       │
│  └────┘ └────┘ └────┘ └────┘       │
│                                     │
│  ☐ My Exercises Only               │
└─────────────────────────────────────┘
```

**Search Algorithm (Aggregate Search):**

The search must support combined queries across multiple fields. Example: searching "core pushup" should return exercises that have "core" as a chip AND "pushup" somewhere in the name or description.

**Query Logic:**
```
For each search term in query:
  - Check if term matches any chip (exact or partial)
  - Check if term appears in name (case-insensitive contains)
  - Check if term appears in description (case-insensitive contains)

Result = exercises where ALL terms match at least one field
```

**Implementation Note:** Firestore doesn't natively support full-text search. Options:
1. **Client-side filtering:** Fetch all relevant exercises, filter in JavaScript (viable for <1000 exercises)
2. **Denormalized search field:** Create `search_tokens` array field combining lowercase name words, description words, and chips for array-contains-any queries

**Chip Filters:**
- Tapping a chip adds it to active filters (highlighted state)
- Tapping again removes it
- Multiple chips = AND logic (exercise must have all selected chips)
- Chips + search text = combined AND query

**Grid Layout:**
- 4-column grid on mobile (compact thumbnails)
- Exercise card shows: media thumbnail, name, type indicator
- Tap to select → returns to routine builder with exercise added

---

### 3.3 Routine Builder

#### 3.3.1 Builder Interface (Drag & Drop)

**Visual Design:**

```
┌─────────────────────────────────────┐
│  ←          Morning Routine    ···  │
├─────────────────────────────────────┤
│                                     │
│  PREP                    [15s] ⌄   │
│  ─────────────────────────────────  │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ≡  🎬  Pushups              │   │  ← Drag handle on left
│  │      10 reps · 20s    [Edit]│   │
│  │      ─────────────────────  │   │
│  │      [+ Add Below]          │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ≡  ⏸  Rest         15s  ⌄  │   │
│  │      [+ Add Below]          │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─ LOOP 3× ────────────────────┐  │
│  │  ┌───────────────────────┐  │   │
│  │  │ ≡ 🎬 Burpees    30s   │  │   │
│  │  │    [+ Add Below]      │  │   │
│  │  └───────────────────────┘  │   │
│  │  ┌───────────────────────┐  │   │
│  │  │ ≡ ⏸ Rest       10s ⌄ │  │   │
│  │  │    [+ Add Below]      │  │   │
│  │  └───────────────────────┘  │   │
│  └──────────────────────────────┘  │
│                                     │
│  ─────────────────────────────────  │
│  COOLDOWN                [15s] ⌄   │
│                                     │
├─────────────────────────────────────┤
│  Total: 4:35                        │
│  [+ Exercise] [+ Break] [+ Loop]   │
│                                     │
│      ┌─────────────────────────┐   │
│      │     Save Routine         │   │
│      └─────────────────────────┘   │
└─────────────────────────────────────┘
```

**Drag & Drop Behavior:**
- Grip handle (≡) on left edge of each block
- Drag to reorder within the routine
- Visual feedback: dragged item lifts with shadow, drop zone highlights
- Blocks within loops can be reordered within or dragged out of the loop
- External blocks can be dragged into loops
- Implemented via Framer Motion's `Reorder` components

**Block Cards:**
- Compact height, no unnecessary padding
- Exercise blocks show: media thumbnail (small), name, config summary
- Break blocks show: duration with inline adjustment dropdown
- Loop blocks: visual container with iteration count badge

#### 3.3.2 Inline Exercise Configuration

When user selects an exercise from the picker, configuration happens **inline within the routine builder** — no popups or modals.

**For "Repeat" Type Exercise:**

```
┌─────────────────────────────────────┐
│  ≡  🎬  Pushups                    │
├─────────────────────────────────────┤
│  How many reps?                     │
│  ┌───┐                             │
│  │ 10│  ← Number input             │
│  └───┘                             │
│                                     │
│  Duration: 20s (2s × 10 reps)      │
│  [Override: _____ s]  ← Optional   │
│                                     │
│  [Confirm]              [Remove]   │
└─────────────────────────────────────┘
```

**For "Timed" Type Exercise:**

```
┌─────────────────────────────────────┐
│  ≡  🎬  Plank Hold                 │
├─────────────────────────────────────┤
│  Duration (seconds)                 │
│  ┌────┐                            │
│  │ 60 │  ← Number input            │
│  └────┘                            │
│                                     │
│  [Confirm]              [Remove]   │
└─────────────────────────────────────┘
```

**Behavior:**
- New exercise appears expanded with configuration fields
- After [Confirm], collapses to compact summary view
- [Edit] button re-expands for modification
- [Remove] deletes the block entirely

#### 3.3.3 Block Addition

| Action | Location | Result |
|--------|----------|--------|
| Tap `[+ Add Below]` on exercise | Below that exercise | Opens exercise picker; selection inserts inline |
| Tap `[+ Add Below]` on break | Below that break | Opens exercise picker; selection inserts inline |
| Tap `[+ Exercise]` at bottom | End of routine | Opens exercise picker |
| Tap `[+ Break]` at bottom | End of routine | Inserts break block (15s default) |
| Tap `[+ Loop]` at bottom | End of routine | Creates empty loop container, prompts for iterations |

#### 3.3.4 Default Values

| Element | Default | Editable | Set to 0 |
|---------|---------|----------|----------|
| Prep Time | 15 seconds | Inline dropdown | Removes prep phase |
| Cooldown Time | 15 seconds | Inline dropdown | Removes cooldown phase |
| Break Duration | 15 seconds | Inline dropdown | N/A (use Remove instead) |
| Loop Iterations | 2 | Number input | N/A (minimum 1) |

---

### 3.4 Live Workout Player

#### 3.4.1 Player Interface

```
┌─────────────────────────────────────┐
│  ✕                     ▸▸  2 of 8  │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │                             │   │
│  │       EXERCISE MEDIA        │   │
│  │      (Looping Video/GIF)    │   │
│  │                             │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│            PUSHUPS                  │
│                                     │
│              0:24                   │
│     ━━━━━━━━━━━━━━━━━━━━━━━        │
│                                     │
│    [+10s]    [ ▶ ]    [⏭]         │
│                                     │
├─────────────────────────────────────┤
│  UP NEXT                            │
│  ┌─────┐ ┌─────┐ ┌─────┐           │
│  │ Rest│ │Burpe│ │ Rest│           │
│  │ 15s │ │ 30s │ │ 15s │           │
│  └─────┘ └─────┘ └─────┘           │
└─────────────────────────────────────┘
```

#### 3.4.2 Control Buttons

| Button | States | Action |
|--------|--------|--------|
| **Play/Pause** | ▶ (paused) / ⏸ (playing) | Toggle countdown. Pausing freezes timer instantly. |
| **Skip** | ⏭ | Advance to next block. Current block logged as skipped. |
| **+10s** | +10s | Add 10 seconds to current block's remaining time. Recorded for post-workout summary. |

#### 3.4.3 Media Buffering (Sliding Window)

**Algorithm:**
1. **Workout start:** Fetch media for blocks 0, 1, 2, 3 (current + next 3)
2. **On block `n` completion:**
   - Evict block `n-1` media from memory (unless still in queue)
   - Add block `n+4` to background download queue
3. **Queue processing:** Sequential background downloads, no UI blocking

**Storage:**
- Buffered media held in memory (blob URLs)
- For offline: Critical blocks written to IndexedDB

**Network Loss Handling:**
- If offline, continue with cached media
- If required media not cached, pause and display "Waiting for connection..."

#### 3.4.4 Session State Management

**Persistence Points:**
- Every block transition
- Every 30 seconds during active exercise
- On pause (explicit or navigation)

**State Document (`users/{userId}/workouts/{workoutId}`):**
```typescript
{
  id: string,
  routine_id: string,
  custom_name: string, // Editable by user
  state: "active" | "paused",
  last_active_timestamp: Timestamp,
  progress_index: number, // Current block index
  current_block_remaining_secs: number,
  modifications: [{block_index: number, added_time: number}],
  skipped_blocks: [number] // Block indices
}
```

**Navigation Behavior:**
- Navigating away → implicit pause → state saved
- Returning within 30 minutes → resume prompt
- Returning after 30 minutes → auto-complete with partial progress

**Auto-Complete Logic:**
```
On app load:
  Check for active workout where last_active_timestamp > 30 minutes ago
  If found:
    → Mark state as "auto_completed"
    → Log to archive with all blocks up to progress_index as completed
    → Clear active workout document
    → Show toast: "Your workout was saved"
```

#### 3.4.5 Offline Execution

**Requirements:**
- Service worker caches app shell and static assets
- Buffered media persists in IndexedDB
- Workout state persists in IndexedDB (syncs to Firestore when online)

**Offline Flow:**
1. User starts workout while online → media buffered
2. Network drops mid-workout → workout continues seamlessly
3. Workout completes → archive entry queued in IndexedDB
4. Network restored → background sync uploads archive entry

---

### 3.5 Post-Workout Summary

#### 3.5.1 Summary Screen

```
┌─────────────────────────────────────┐
│                                     │
│              ✓                      │
│        WORKOUT COMPLETE             │
│                                     │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ Morning Routine         [✎]│   │  ← Tap to edit name
│  └─────────────────────────────┘   │
│                                     │
│  Duration: 24:35                    │
│  Completed: 12/14 blocks            │
│                                     │
├─────────────────────────────────────┤
│  CAPTURE A MEMORY                   │
│                                     │
│       ┌───────────────┐            │
│       │               │            │
│       │   📷          │            │
│       │  Tap: Photo   │            │
│       │  Hold: Video  │            │
│       │               │            │
│       └───────────────┘            │
│                                     │
│  ┌────┐ ┌────┐ ┌────┐              │  ← Captured media thumbnails
│  │ 🖼 │ │ 🎬 │ │ +  │              │
│  └────┘ └────┘ └────┘              │
│                                     │
├─────────────────────────────────────┤
│  BLOCKS COMPLETED                   │
│  ✓ Prep (15s)                      │
│  ✓ Pushups (30s)                   │
│  ✓ Rest (15s)                      │
│  ✓ Squats (40s) → +10s             │
│  ✓ Rest (15s)                      │
│  ⊘ Burpees (skipped)               │
│  ✓ Plank (60s)                     │
│  ✓ Cooldown (15s)                  │
│                                     │
├─────────────────────────────────────┤
│  SAVE CHANGES TO ROUTINE?           │
│  (Only shown if modifications made) │
│                                     │
│  ☑ Update Squats to 50s (+10s)     │
│  ☑ Remove Burpees                   │
│                                     │
│  [Save Changes] [Keep As-Is]        │
│                                     │
├─────────────────────────────────────┤
│          ┌─────────────┐            │
│          │    Done     │            │
│          └─────────────┘            │
└─────────────────────────────────────┘
```

#### 3.5.2 Workout Name Editing

**Behavior:**
- Default name: Routine name (e.g., "Morning Routine")
- Tap pencil icon → inline text input becomes editable
- User can rename to anything (e.g., "Lior and Yair at the beach")
- Custom name stored in `archive.custom_name`

#### 3.5.3 Memory Capture (Photo/Video)

**Camera Interface:**

```
┌─────────────────────────────────────┐
│                                     │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │                             │   │
│  │        CAMERA PREVIEW       │   │
│  │                             │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│              ┌───┐                 │
│              │ ◉ │  ← Shutter      │
│              └───┘                 │
│         Tap: Photo                  │
│         Hold 3s: Video              │
│                                     │
│  [✕ Cancel]           [🔄 Flip]    │
└─────────────────────────────────────┘
```

**Interaction:**
- **Tap shutter:** Capture single photo
- **Long-press shutter (3 seconds):** Record 3-second video loop
- Visual feedback during long-press: ring animation around shutter fills over 3s
- On release before 3s: Cancel video, take photo instead (or cancel entirely)

**After Capture:**
- Media appears as thumbnail in gallery row
- Tap thumbnail to preview/delete
- Can capture multiple photos/videos
- All captured media uploaded to Firebase Storage on [Done]

**Storage Path:**
```
users/{userId}/memories/{archiveId}/{filename}
```

#### 3.5.4 Routine Mutation Options

**Displayed only when user used Skip or +10s:**

| Modification During Workout | Option Presented |
|-----------------------------|------------------|
| +10s on exercise | "Update [Name] to [new duration]" |
| Skipped exercise | "Remove [Name] from routine" |

**Behavior:**
- Each modification is a checkbox (default: checked)
- User can uncheck to exclude specific changes
- [Save Changes] applies selected modifications to `users/{userId}/routines/{routineId}`
- [Keep As-Is] saves archive without modifying routine

---

## 4. User Flows

### 4.1 First-Time User Flow

```
Landing Page 
  → [Continue with Google] 
  → Firebase Auth (Google OAuth)
  → Onboarding Step 1: Name + Phone
  → Onboarding Step 2: Referral Source
  → Dashboard (empty state with prompts)
```

### 4.2 Create Exercise Flow

```
Dashboard 
  → [+ New Exercise]
  → Exercise Form (name, description, type, chips, privacy)
  → Media Upload
    └── (If video > 10s) → Video Trimmer → Confirm
  → Save
  → Exercise created in exercises/{exerciseId}
```

### 4.3 Create Routine Flow

```
Dashboard 
  → [+ New Routine]
  → Routine Builder (empty)
  → [+ Exercise] → Exercise Picker → Select → Inline Config → Confirm
  → Drag to reorder
  → [+ Break] to add rest periods
  → Adjust Prep/Cooldown times
  → [Save Routine]
  → Routine saved to users/{userId}/routines/{routineId}
```

### 4.4 Execute Workout Flow

```
Dashboard 
  → My Routines 
  → Tap Routine Card 
  → [Start Workout]
  → Player loads (buffers first 4 blocks)
  → Prep countdown
  → Exercise blocks (media loops, timer counts)
    → User may: Pause, Skip, +10s
  → Cooldown completes
  → Post-Workout Summary
    → Edit workout name (optional)
    → Capture memory photos/videos (optional)
    → Review modifications (if any)
    → [Save Changes] or [Keep As-Is]
  → [Done]
  → Archive entry created
```

### 4.5 Resume Workout Flow

```
User returns (< 30 min since pause)
  → App detects active workout
  → Resume prompt: "Continue Morning Routine?"
  → [Continue] → Load state → Resume at exact position
  → [Discard] → Delete workout document (no archive)
```

### 4.6 Auto-Complete Flow

```
User returns (> 30 min since pause)
  → App detects stale workout
  → Auto-complete triggered
  → Archive entry created (completion_type: "auto_completed")
  → Toast: "Your workout was saved"
  → Dashboard shown
```

---

## 5. UI/UX Design Guidelines

### 5.1 Design Philosophy

**Instagram-Inspired Aesthetic:**
- Compact information density — no excessive whitespace
- Smooth, spring-physics animations (Framer Motion)
- Gesture-first interactions (swipe, drag, long-press)
- Visual hierarchy through subtle shadows, not heavy borders
- Monochromatic base with single accent color
- Photography/media as primary visual element

**Anti-Patterns to Avoid:**
- Generic card layouts with excessive padding
- Obvious "AI-generated" copy (no "Welcome back!" headers)
- Over-explained UI (trust users to explore)
- Hover states as primary interactions
- Modal overload — prefer inline expansion

### 5.2 Responsive Strategy

| Breakpoint | Target | Layout |
|------------|--------|--------|
| < 640px | Primary (Mobile) | Single column, bottom actions, full-width cards |
| 640-1024px | Secondary (Tablet) | Two-column where appropriate |
| > 1024px | Fallback (Desktop) | Centered container (max-width: 480px), app-like feel |

### 5.3 Touch Targets

- Minimum interactive size: 44x44px
- Primary actions (Save, Start, Done): Full-width buttons
- Secondary actions: Pill-shaped, high contrast
- Destructive actions: Require confirmation or undo

### 5.4 Animation Guidelines

| Interaction | Animation |
|-------------|-----------|
| Page transition | Horizontal slide (120ms) |
| Modal appear | Fade + scale from 95% (150ms) |
| Drag reorder | Item lifts with shadow, spring settle |
| Button press | Scale down to 97% on press |
| Timer tick | No animation (performance) |
| Block complete | Brief pulse + slide out |

### 5.5 Accessibility

- Keyboard navigation support (tab, enter, escape)
- ARIA labels on all interactive elements
- Color contrast: WCAG AA minimum (4.5:1)
- Focus rings: Visible but subtle (2px accent)
- Screen reader: Logical heading hierarchy

---

## 6. Offline Capabilities

### 6.1 PWA Configuration

```javascript
// next.config.js with next-pwa
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/firebasestorage\.googleapis\.com/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'media-cache',
        expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 }
      }
    }
  ]
});
```

### 6.2 Cache Strategy

| Resource | Strategy | TTL |
|----------|----------|-----|
| App shell (HTML, JS, CSS) | Cache-first, background update | 7 days |
| Exercise media (during workout) | Cache-first | Session |
| User data (routines, exercises) | Network-first, IndexedDB fallback | Real-time |
| Archive entries (pending sync) | IndexedDB queue | Until synced |

### 6.3 Sync Queue

**Offline Actions Queued:**
- Completed workout archive entries
- Captured memory photos/videos
- Routine modifications

**Sync Process:**
1. Network restored event detected
2. Background sync iterates IndexedDB queue
3. Each item uploaded to Firestore/Storage
4. On success: Remove from queue
5. On failure: Retry with exponential backoff

---

## 7. Security & Data Privacy

### 7.1 Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users: Own data only
    match /users/{userId} {
      allow read, write: if request.auth != null 
                         && request.auth.uid == userId;
      
      // Routines: Private subcollection
      match /routines/{routineId} {
        allow read, write: if request.auth != null 
                           && request.auth.uid == userId;
      }
      
      // Active workouts: Private subcollection
      match /workouts/{workoutId} {
        allow read, write: if request.auth != null 
                           && request.auth.uid == userId;
      }
      
      // Archive: Private subcollection
      match /archive/{archiveId} {
        allow read, write: if request.auth != null 
                           && request.auth.uid == userId;
      }
    }
    
    // Exercises: Public read (if is_public), author write
    match /exercises/{exerciseId} {
      allow read: if request.auth != null 
                  && (resource.data.is_public == true 
                      || resource.data.author_id == request.auth.uid);
      allow create: if request.auth != null 
                    && request.resource.data.author_id == request.auth.uid;
      allow update, delete: if request.auth != null 
                            && resource.data.author_id == request.auth.uid;
    }
  }
}
```

### 7.2 Storage Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Exercise media: Author write, authenticated read
    match /exercises/{userId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null 
                   && request.auth.uid == userId
                   && request.resource.size < 10 * 1024 * 1024; // 10MB limit
    }
    
    // Memory media: Owner only
    match /users/{userId}/memories/{archiveId}/{fileName} {
      allow read, write: if request.auth != null 
                         && request.auth.uid == userId
                         && request.resource.size < 15 * 1024 * 1024; // 15MB limit
    }
  }
}
```

---

## 8. Technical Constraints & Decisions

| Constraint | Decision | Rationale |
|------------|----------|-----------|
| Video duration | Max 10 seconds | Keeps uploads small, forces concise demonstrations |
| Video processing | Client-side HTML5 trimming | No backend compute costs, immediate feedback |
| Media buffering | Sliding window (current + 3) | Balances preload with memory usage |
| Auto-complete timeout | 30 minutes inactivity | Reasonable session boundary |
| Archive granularity | One document per workout | Balances detail with Firestore write costs |
| Phone format | Israeli only (+972) | Focused launch market |
| Authentication | Google OAuth only | Simplest onboarding, no password management |
| Routine visibility | Private only (no sharing) | V1 scope constraint |

---

## 9. Implementation Phases

### Phase 1: Foundation
- Firebase project setup (Auth, Firestore, Storage)
- Next.js project with App Router
- Tailwind CSS configuration
- Zustand store setup
- Google Auth integration
- Onboarding flow (name, phone, referral)
- Basic dashboard shell

### Phase 2: Exercise Management
- Exercise creation form
- Media upload to Storage
- Video trimmer (HTML5 implementation)
- Exercise discovery with aggregate search
- Chip filtering

### Phase 3: Routine Builder
- Routine CRUD operations
- Drag-and-drop block reordering (Framer Motion)
- Inline exercise configuration (no modals)
- Break and loop functionality
- Prep/cooldown configuration

### Phase 4: Live Workout Player
- Timer engine with Zustand
- Media buffering (sliding window)
- Play/Pause/Skip/+10s controls
- Progress indicator and "Up Next" queue
- State persistence to Firestore

### Phase 5: Session & Archive
- Pause on navigation
- Resume flow with prompt
- Auto-complete (30 min timeout)
- Post-workout summary
- Memory capture (photo/video)
- Workout name editing
- Routine mutation options
- Archive logging

### Phase 6: Offline & PWA
- Service worker (next-pwa)
- IndexedDB integration (Dexie.js)
- Offline workout execution
- Sync queue for pending uploads
- Install prompt

---

## 10. Appendix: Component Inventory

### Core Components

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `ExerciseCard` | Display exercise in picker/discovery | exercise, onSelect |
| `RoutineBlockCard` | Draggable block in builder | block, onEdit, onRemove |
| `BlockConfigInline` | Inline configuration for new exercise | exercise, onConfirm, onCancel |
| `VideoTrimmer` | 10s clip selection | videoFile, onTrim, onCancel |
| `PlayerTimer` | Countdown display with controls | remainingSecs, onPause, onSkip, onAddTime |
| `MediaPlayer` | Looping video/gif/image | mediaUrl, mediaType |
| `MemoryCapture` | Camera interface for photos/videos | onCapture, captures |
| `SummaryModifications` | Checkbox list for routine updates | modifications, onSave |

### Layout Components

| Component | Purpose |
|-----------|---------|
| `MobileShell` | App wrapper with bottom nav |
| `ModalSheet` | Bottom sheet for pickers/confirmations |
| `InlineExpander` | Collapsible section with animation |
