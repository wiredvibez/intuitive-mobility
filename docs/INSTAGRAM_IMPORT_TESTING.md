# Instagram Video Import — Testing Guide

## Deployment Status

- **Firestore rules** — Deployed
- **Storage rules** — Deployed  
- **Firestore indexes** — Deployed
- **Cloud Functions** — Deployed (us-central1)
  - `onVideoImportJobCreated` — Firestore trigger
  - `approveImportExerciseCallable`
  - `removeImportExerciseCallable`
  - `rejectImportJobCallable`

## Prerequisites

1. **yt-dlp** — Required for downloading Instagram videos. Cloud Functions use `youtube-dl-exec` which bundles yt-dlp at build time.
2. **GEMINI_API_KEY** — Set in `functions/.env` (loaded on deploy).

## How to Test

### 1. Run the app

```bash
npm run dev
```

### 2. Sign in

Use Google Sign-In to authenticate.

### 3. Go to Exercises

Navigate to the Exercises page.

### 4. Start an import

1. Click **Import**
2. Paste an Instagram Reel URL, e.g.:
   - `https://www.instagram.com/reel/ABC123xyz/`
   - `https://www.instagram.com/p/ABC123xyz/`
3. Click **Start Import**

### 5. Watch the pending card

A card appears at the top showing status:

- **Processing** — Downloading, analyzing, cutting clips
- **Ready to review** — Click **Review**
- **Error** — Message + **Dismiss**

### 6. Review exercises

In the review screen:

- Edit name, description, type, chips
- **Approve** — Adds exercise to your library (public, with credit)
- **Remove** — Skips this exercise
- **Skip** — Move to next without acting

### 7. Verify

- Approved exercises appear in **My Exercises**
- Each has `credit` set to the Instagram creator handle
- `is_public` is `true` (locked for imports)

## Troubleshooting

| Issue | Check |
|-------|------|
| "GEMINI_API_KEY not configured" | Ensure `functions/.env` has `GEMINI_API_KEY=...` and redeploy |
| "Could not download video" | Instagram may block; try a different reel or check yt-dlp |
| "Not a fitness video" | AI determined it's not fitness content |
| "No exercises detected" | AI found no clear exercises in the video |
| Pending card doesn't update | Refresh the page; Firestore listener should sync |

## Local emulator (optional)

To test without deploying:

```bash
# Terminal 1: Start emulators
firebase emulators:start --only functions,firestore

# Terminal 2: Run app (point to emulator via .env.local)
npm run dev
```

Set in `.env.local`:

```
NEXT_PUBLIC_FIREBASE_EMULATOR_FIRESTORE=localhost:8080
NEXT_PUBLIC_FIREBASE_EMULATOR_FUNCTIONS=localhost:5001
```

Note: The Firestore trigger runs in the emulator, but yt-dlp and ffmpeg must be available on your machine for the download/cut steps.
