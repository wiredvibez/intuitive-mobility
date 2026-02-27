# Instagram Video Import Feature — Design Document

**Date:** 2025-02-27  
**Status:** Draft for approval

---

## 1. Overview

Users can paste an Instagram video URL to import fitness exercises. The system downloads the video, runs AI analysis to detect exercises and timestamps, cuts the video into clips, and presents them for review. Users approve or remove each exercise one-by-one; approved exercises are added to their library with `is_public: true` and `credit` set to the Instagram creator handle.

Processing runs in the background via a Firestore-triggered Cloud Function. A floating "pending video process" card on the exercises page shows status; when ready, users review in a player similar to the live workout view with edit controls.

---

## 2. Data Models

### 2.1 Video Import Job

**Collection:** `video_import_jobs`  
**Document ID:** Auto-generated

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Same as doc ID |
| `user_id` | string | Owner |
| `instagram_url` | string | Original URL |
| `status` | enum | See status flow below |
| `status_message` | string? | User-facing message (e.g. error reason) |
| `created_at` | Timestamp | |
| `updated_at` | Timestamp | |
| `instagram_metadata` | object? | Author, caption, duration, etc. (from yt-dlp) |
| `exercises` | array | Pending exercises (see below) |
| `storage_ref_full` | string? | Temp path to full video (before cleanup) |
| `storage_ref_clips` | string[]? | Temp paths to clip files |
| `ai_analysis_log_id` | string? | Reference to `ai_analysis_log` doc |

**Status enum:** `created` | `invoked` | `v_downloaded` | `analyzed` | `await_approve` | `incomplete_approve` | `complete` | `error` | `rejected`

**Exercise item (within `exercises` array):**

| Field | Type | Description |
|-------|------|-------------|
| `index` | number | 0-based order |
| `name` | string | From AI |
| `description` | string | From AI |
| `type` | `'repeat'` \| `'timed'` | From AI |
| `default_time_per_rep_secs` | number? | For repeat type |
| `chips` | string[] | From AI (mapped to EXERCISE_CHIPS) |
| `timestamp_start` | number | Seconds |
| `timestamp_end` | number | Seconds |
| `media_url` | string? | URL to clip (in temp storage) |
| `status` | `'pending'` \| `'approved'` \| `'removed'` | |
| `exercise_id` | string? | Set when approved (Firestore exercise doc ID) |

### 2.2 AI Analysis Log

**Collection:** `ai_analysis_log`  
**Created:** On every Cloud Function run (success or failure)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Doc ID |
| `job_id` | string | `video_import_jobs` doc ID |
| `user_id` | string | |
| `instagram_url` | string | |
| `storage_ref` | string? | If video was saved to temp |
| `metadata` | object | Instagram metadata |
| `prompt_used` | string | System + user prompt |
| `returned_json` | object | Raw AI response |
| `status` | string | `success` \| `error` |
| `error_message` | string? | If failed |
| `created_at` | Timestamp | |

### 2.3 Exercise (extended)

**New field:** `credit?: string` — Instagram creator handle (e.g. `@username`)

### 2.4 User (extended)

**New field:** `analyzed_video_urls?: string[]` — URLs user has already imported (for duplicate detection)

---

## 3. Storage Layout

```
temp/imports/{jobId}/
  full.mp4
  clips/
    0.mp4
    1.mp4
    ...

exercises/{userId}/{exerciseId}.mp4   (after approval)

# Cleanup: Delete temp/imports/{jobId}/ when job is complete, error, or rejected
```

---

## 4. Status Flow

```
created → invoked → v_downloaded → analyzed → await_approve
                                              ↓
                                    incomplete_approve (user acts on some)
                                              ↓
                                    complete (all acted on)

Any stage → error (system failure)
await_approve → rejected (user dismisses)
```

---

## 5. Cloud Function Pipeline

**Trigger:** Firestore `onCreate` on `video_import_jobs` where `status == 'created'`

**Steps:**

1. **Duplicate check**  
   If `instagram_url` in user's `analyzed_video_urls` → set `status: 'error'`, `status_message: 'Already imported'`, create `ai_analysis_log`, return.

2. **invoked**  
   Update job `status: 'invoked'`.

3. **Download**  
   - Use yt-dlp (or equivalent) to download to `temp/imports/{jobId}/full.mp4`  
   - Parse metadata  
   - Update `status: 'v_downloaded'`, `instagram_metadata`  
   - On failure: `status: 'error'`, create log, cleanup temp, return.

4. **Analysis**  
   - Call AI (Gemini preferred; video-native)  
   - Fitness-specific prompt:  
     - Is this a fitness video?  
     - Is there at least one exercise demonstrated?  
     - If no → `status: 'error'`, `status_message: 'Not a fitness video'` or `'No exercises detected'`, create log, cleanup, return.  
   - If yes → extract exercise items with timestamps and full Exercise fields.

5. **ai_analysis_log**  
   Create doc with: `storage_ref`, `instagram_url`, `metadata`, `prompt_used`, `returned_json`, etc.

6. **Cut clips**  
   - Use ffmpeg to cut `full.mp4` by timestamps  
   - Upload clips to `temp/imports/{jobId}/clips/{i}.mp4`  
   - Get download URLs, store in `exercises[i].media_url`  
   - Delete `full.mp4` (keep clips only)

7. **await_approve**  
   Update `status: 'await_approve'`, `exercises` with clip URLs.

8. **Cleanup**  
   On any failure (error/rejected): delete `temp/imports/{jobId}/`.

**Dependencies:**

- yt-dlp (or bundled binary) in Cloud Functions  
- ffmpeg (available in Firebase Functions runtime)  
- Gemini API key (or fallback to GPT)

---

## 6. AI Prompt (Fitness-Specific)

**Schema for output:**

```json
{
  "is_fitness_video": boolean,
  "has_exercises": boolean,
  "rejection_reason": "string | null",
  "exercises": [
    {
      "name": "string",
      "description": "string",
      "type": "repeat | timed",
      "default_time_per_rep_secs": number,
      "chips": ["string"],
      "timestamp_start": number,
      "timestamp_end": number
    }
  ]
}
```

**Rules:**

- If `is_fitness_video` false or `has_exercises` false → set `rejection_reason`, return early; no exercises.
- Use `EXERCISE_CHIPS` for `chips`; map AI output to closest matches.
- Timestamps in seconds, precise.

---

## 7. Approval Flow

- User sees job with `status: 'await_approve'` or `'incomplete_approve'`.
- Review UI: player similar to `WorkoutPlayer`: video, name, description, type, chips, etc.
- Controls:  
  - **Approve** → create Exercise in Firestore, copy clip from temp to `exercises/{userId}/{exerciseId}.mp4`, set `exercises[i].status: 'approved'`, `exercises[i].exercise_id`, `credit: @handle` from metadata.  
  - **Remove** → set `exercises[i].status: 'removed'`.
- When all items have `status` in `['approved','removed']` → `status: 'complete'`, delete `temp/imports/{jobId}/`.

---

## 8. UI Components

### 8.1 Import Entry Point

- On exercises page: "Import from Instagram" button or input.
- URL input + submit → create `video_import_jobs` doc with `status: 'created'` → Firestore trigger runs pipeline.

### 8.2 Pending Video Process Card

- Floating at top of exercises page.
- Shows: status, progress (if available), error message.
- States:  
  - Processing: spinner + status text  
  - Ready: "Ready to review"  
  - Error: message + "Dismiss"  
  - Rejected: same as error, dismissible.

### 8.3 Review Player

- Full-screen, similar to `WorkoutPlayer`.
- Shows current exercise: video, name, description, type, chips.
- Editable fields: name, description, type, chips, etc.
- Controls: Approve, Remove, Skip (next).
- On Approve: save edits, create exercise, move to next.
- On Remove: mark removed, move to next.
- When all done: close, return to exercises page.

---

## 9. Security Rules

- `video_import_jobs`: read/write by `user_id == auth.uid`.
- `ai_analysis_log`: write by Cloud Function only; read by admins or user (optional).
- Storage:  
  - `temp/imports/{jobId}/`: Cloud Function only (admin SDK).  
  - `exercises/{userId}/{exerciseId}.mp4`: same as existing exercise media rules.

---

## 10. Error Handling

| Scenario | Job status | User sees | Cleanup |
|---------|------------|-----------|---------|
| Duplicate URL | error | "Already imported" | N/A |
| Invalid URL | error | "Invalid Instagram URL" | N/A |
| Download failed | error | "Could not download video" | N/A |
| Not fitness | error | "Not a fitness video" | Yes |
| No exercises | error | "No exercises detected" | Yes |
| AI failure | error | "Analysis failed" | Yes |
| User dismisses | rejected | — | Yes |

---

## 11. Resilience

- **Idempotency:** Duplicate check before processing.
- **Logging:** Every run logged in `ai_analysis_log`.
- **Cleanup:** Temp storage always deleted on terminal states.
- **Timeout:** Cloud Function timeout (e.g. 9 min) for long videos.
- **Retries:** Consider Firebase Functions retry policy for transient failures.

---

## 12. Out of Scope (Stage 2)

- Global cache of analyzed videos by URL.
- Skip analysis when URL already analyzed globally.
- Fetch cached results for new users importing same URL.

---

## 13. Implementation Checklist

- [x] Add `credit` to Exercise type.
- [x] Add `analyzed_video_urls` to User.
- [x] Create `video_import_jobs` collection and Firestore rules.
- [x] Create `ai_analysis_log` collection and Firestore rules.
- [x] Add `temp/imports/` storage rules (admin only).
- [x] Initialize Cloud Functions project.
- [x] Implement download (youtube-dl-exec).
- [x] Implement fitness-specific AI prompt and parsing.
- [x] Implement ffmpeg cutting.
- [x] Implement Firestore onCreate trigger.
- [x] Implement ai_analysis_log creation on every run.
- [x] Add Import URL entry UI.
- [x] Add PendingVideoProcessCard.
- [x] Add ImportReviewPlayer.
- [x] Add approval logic (create exercise, copy clip, update job).
- [x] Add duplicate detection and user doc update.
