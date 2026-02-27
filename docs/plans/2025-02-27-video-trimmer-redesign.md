# Video Trimmer Redesign — Exercise Creation

**Date:** 2025-02-27
**Status:** Plan for approval

---

## 1. Overview

Redesign the video trimmer in the exercise creation flow to support free-length control (up to 15s max), always show the trimmer for any video upload, and adopt an Instagram story–style trimmer UX.

---

## 2. Current Behavior

| Aspect | Current |
|--------|---------|
| **When trimmer shows** | Only when video > 10s |
| **Clip length** | Fixed 10s window; user pans left/right |
| **Duration limit** | `MAX_VIDEO_DURATION_SECS = 10` |
| **Controls** | Single drag on timeline (pan entire window) |
| **Timeline** | Selection bar with fixed width; no thumbnails |

---

## 3. Target Behavior

| Aspect | Target |
|--------|--------|
| **When trimmer shows** | Always for video uploads (including videos < 15s) |
| **Clip length** | Free: user chooses start and end (1s–15s) |
| **Duration limit** | 15s max |
| **Controls** | Independent left/right handles (Instagram-style) |
| **Timeline** | Horizontal strip with thumbnails, draggable handles |

---

## 4. Instagram Story Trimmer Inspiration

Reference: Instagram’s native story video trimmer (iOS).

**Key UX elements:**
- Horizontal timeline at bottom with thumbnails/frames
- Two draggable handles (left = start, right = end)
- Live preview updates as handles move
- Minimal chrome; “Done” primary action
- Clear visual feedback for selected range

---

## 5. Implementation Plan

### 5.1 Constants & Validators

**File:** `src/lib/utils/validators.ts`

- Change `MAX_VIDEO_DURATION_SECS` from `10` to `15`.

**File:** `src/components/exercises/ExerciseForm.tsx`

- Remove duration check in `handleFileSelect`.
- For any video file: always show trimmer (no bypass).
- Keep `handleTrimComplete` for when user confirms trim.

---

### 5.2 ExerciseForm Flow

**Current logic:**
```ts
if (isVideoFile(file)) {
  const dur = await getVideoDuration(file);
  if (dur > MAX_VIDEO_DURATION_SECS) {
    setTrimSource(file);
    setShowTrimmer(true);
    return;
  }
}
setMediaFile(file);  // bypass trimmer for short videos
```

**New logic:**
```ts
if (isVideoFile(file)) {
  setTrimSource(file);
  setShowTrimmer(true);
  return;
}
setMediaFile(file);  // only for non-video (images)
```

---

### 5.3 VideoTrimmer Component Redesign

**File:** `src/components/exercises/VideoTrimmer.tsx`

#### 5.3.1 State & Props

- `maxClipDuration = 15` (constant)
- `startTime`, `endTime` — independent state (instead of fixed-width window)
- `duration` — full video duration

#### 5.3.2 Initial Selection

- If `duration <= 15`: start = 0, end = duration (full video selected by default)
- If `duration > 15`: start = 0, end = 15 (first 15s)

#### 5.3.3 Timeline UI (Instagram-style)

1. **Thumbnail strip**
   - Optional: generate thumbnails at regular intervals (e.g. every 5% of duration) for visual timeline
   - Fallback: gradient or solid color strip if thumbnails are slow/heavy

2. **Selection range**
   - Highlighted area between `startTime` and `endTime`
   - Dimmed areas outside selection

3. **Handles**
   - Left handle: drag to change `startTime`
   - Right handle: drag to change `endTime`
   - Constraints:
     - `startTime >= 0`
     - `endTime <= duration`
     - `endTime - startTime <= 15`
     - `endTime - startTime >= 0.5` (min 0.5s to avoid tiny clips)

4. **Handle interaction**
   - Track which handle is being dragged (`'left' | 'right' | null`)
   - On pointer move: update corresponding time, clamp to constraints
   - When dragging left handle: ensure `endTime - startTime <= 15`
   - When dragging right handle: same constraint

#### 5.3.4 “Use full video” option

- For videos `<= 15s`: show a subtle “Use full video” option so user can skip trimming without confirming
- Or: default selection is full video; user can tap “Done” to confirm

#### 5.3.5 Time display

- Left: `startTime` (e.g. `0:00`)
- Center: selected duration (e.g. `0:12` selected)
- Right: `endTime` or total duration

#### 5.3.6 Trim logic

- `handleTrim` uses `startTime` and `endTime` (not fixed `maxClip`)
- Encode from `startTime` to `endTime` (variable duration)

---

### 5.4 Thumbnail Strip (Optional Enhancement)

**Approach A: Canvas-based thumbnails**
- Use `video` element + `canvas` to capture frames at N intervals
- Render as small images in a horizontal strip

**Approach B: CSS-only**
- Skip thumbnails; use a solid/gradient strip with clear selection highlight
- Simpler, faster to implement

**Recommendation:** Start with Approach B; add thumbnails in a follow-up if needed.

---

### 5.5 Edge Cases

| Case | Behavior |
|------|----------|
| Video < 0.5s | Show trimmer; selection = full video; no handles needed (or disable trim) |
| Video 0.5s–15s | Full video selected by default; user can trim if desired |
| Video > 15s | First 15s selected; user adjusts start/end |
| User drags past 15s | Clamp selection to max 15s |

---

### 5.6 Files to Modify

| File | Changes |
|------|---------|
| `src/lib/utils/validators.ts` | `MAX_VIDEO_DURATION_SECS = 15` |
| `src/components/exercises/ExerciseForm.tsx` | Always show trimmer for videos |
| `src/components/exercises/VideoTrimmer.tsx` | Full redesign: dual handles, free length, 15s max |

---

## 6. Implementation Order

1. Update `MAX_VIDEO_DURATION_SECS` to 15.
2. Update `ExerciseForm` to always show trimmer for videos.
3. Refactor `VideoTrimmer`:
   - Add `endTime` state; replace fixed-width logic with `startTime`/`endTime`.
   - Implement left/right handle drag (with `handle` state: `'left' | 'right' | null`).
   - Add constraints (min 0.5s, max 15s).
   - Update `handleTrim` to use variable `endTime - startTime`.
4. Polish timeline UI (handle styling, selection highlight).
5. (Optional) Add thumbnail strip; otherwise keep gradient/solid strip.

---

## 7. Security & Storage

- No changes to Firestore rules.
- Storage rules unchanged; upload size may increase slightly if users choose longer clips (up to 15s).
- No new Firebase config.

---

## 8. Out of Scope

- Thumbnail generation (can be Phase 2).
- Video format conversion (keep current WebM output).
- Trim preview scrubbing (playback only; handles update preview).
