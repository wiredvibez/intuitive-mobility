import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as fs from 'fs';
import * as path from 'path';
import youtubedl from 'youtube-dl-exec';
import ffmpegPath from 'ffmpeg-static';
import { execSync } from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';

const COOKIES_PATH = '/tmp/ig_cookies.txt';

async function ensureCookieFile(): Promise<string | undefined> {
  // Try Firestore first (admin-managed cookies via /admin/settings)
  try {
    const snap = await getDb().collection('app_settings').doc('instagram').get();
    const data = snap.data();
    if (data?.instagram_cookies_base64) {
      const decoded = Buffer.from(data.instagram_cookies_base64 as string, 'base64').toString('utf-8');
      fs.writeFileSync(COOKIES_PATH, decoded, 'utf-8');
      return COOKIES_PATH;
    }
  } catch (err) {
    functions.logger.warn('Failed to read cookies from Firestore', err);
  }

  // Fallback to env var
  const raw = process.env.INSTAGRAM_COOKIES;
  if (!raw) return undefined;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    fs.writeFileSync(COOKIES_PATH, decoded, 'utf-8');
    return COOKIES_PATH;
  } catch {
    functions.logger.warn('Failed to write Instagram cookie file');
    return undefined;
  }
}

function getDb() {
  return admin.firestore();
}
function getStorage() {
  return admin.storage().bucket();
}

const EXERCISE_CHIPS = [
  'Core',
  'Arms',
  'Legs',
  'Cardio',
  'Stretch',
  'Balance',
  'Back',
  'Chest',
  'Shoulders',
  'Full Body',
];

interface InstagramMetadata {
  author?: { username?: string | null; full_name?: string | null; profile_url?: string | null };
  caption?: string | null;
  duration_seconds?: number | null;
  view_count?: number | null;
  like_count?: number | null;
  comment_count?: number | null;
  hashtags?: string[];
  mentions?: string[];
  url?: string;
}

interface AIExerciseItem {
  name: string;
  description: string;
  type: 'repeat' | 'timed';
  default_time_per_rep_secs?: number;
  chips: string[];
  timestamp_start: number;
  timestamp_end: number;
}

interface AIAnalysisResult {
  is_fitness_video: boolean;
  has_exercises: boolean;
  rejection_reason?: string | null;
  exercises: AIExerciseItem[];
}

function createAnalysisLog(params: {
  jobId: string;
  userId: string;
  instagramUrl: string;
  storageRef?: string;
  metadata: InstagramMetadata;
  promptUsed: string;
  returnedJson: unknown;
  status: 'success' | 'error';
  errorMessage?: string;
}): Promise<string> {
  const ref = getDb().collection('ai_analysis_log').doc();
  return ref.set({
    id: ref.id,
    job_id: params.jobId,
    user_id: params.userId,
    instagram_url: params.instagramUrl,
    storage_ref: params.storageRef ?? null,
    metadata: params.metadata,
    prompt_used: params.promptUsed,
    returned_json: params.returnedJson,
    status: params.status,
    error_message: params.errorMessage ?? null,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  }).then(() => ref.id);
}

async function updateJob(
  jobId: string,
  data: Record<string, unknown>
): Promise<void> {
  await getDb().collection('video_import_jobs').doc(jobId).update({
    ...data,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function setJobError(
  jobId: string,
  message: string,
  logId?: string
): Promise<void> {
  await updateJob(jobId, {
    status: 'error',
    status_message: message,
    ai_analysis_log_id: logId ?? null,
  });
}

function parseMetadata(ytdlpInfo: Record<string, unknown>, url: string): InstagramMetadata {
  const desc = (ytdlpInfo.description as string) || '';
  const extractHashtags = (t: string) =>
    (t.match(/#[\w\u0080-\uFFFF]+/g) || []).map((h) => h.toLowerCase());
  const extractMentions = (t: string) =>
    (t.match(/@[\w.]+/g) || []).map((m) => m.toLowerCase());

  return {
    author: {
      username: (ytdlpInfo.uploader_id as string) || (ytdlpInfo.channel_id as string) || null,
      full_name: (ytdlpInfo.uploader as string) || (ytdlpInfo.channel as string) || null,
      profile_url: (ytdlpInfo.uploader_url as string) || (ytdlpInfo.channel_url as string) || null,
    },
    caption: desc || (ytdlpInfo.title as string) || null,
    duration_seconds: (ytdlpInfo.duration as number) || null,
    view_count: (ytdlpInfo.view_count as number) || null,
    like_count: (ytdlpInfo.like_count as number) || null,
    comment_count: (ytdlpInfo.comment_count as number) || null,
    hashtags: extractHashtags(desc),
    mentions: extractMentions(desc),
    url,
  };
}

function mapChipsToRegistry(chips: string[]): string[] {
  const lower = EXERCISE_CHIPS.map((c) => c.toLowerCase());
  return chips
    .map((c) => {
      const cc = c.trim();
      if (!cc) return null;
      const found = lower.find((l) => l.includes(cc.toLowerCase()) || cc.toLowerCase().includes(l));
      return found ? EXERCISE_CHIPS[lower.indexOf(found)] : cc;
    })
    .filter((c): c is string => c != null)
    .slice(0, 5);
}

const FITNESS_SYSTEM_PROMPT = `You are a fitness video analyzer. Watch the video and determine:
1. Is this a FITNESS video? (exercise, workout, movement, training content)
2. Does it show at least ONE clearly demonstrated exercise?
3. If yes, list each exercise with precise timestamps (start and end in seconds) and full metadata.

Output ONLY valid JSON matching this schema:
{
  "is_fitness_video": boolean,
  "has_exercises": boolean,
  "rejection_reason": "string or null (if not fitness or no exercises)",
  "exercises": [
    {
      "name": "string",
      "description": "string (how to perform, form cues)",
      "type": "repeat or timed",
      "default_time_per_rep_secs": number (for repeat, seconds per rep),
      "chips": ["string"] (from: Core, Arms, Legs, Cardio, Stretch, Balance, Back, Chest, Shoulders, Full Body),
      "timestamp_start": number (seconds),
      "timestamp_end": number (seconds)
    }
  ]
}`;

export async function processVideoImportPipeline(
  jobId: string,
  job: Record<string, unknown>
): Promise<void> {
  const userId = job.user_id as string;
  const instagramUrl = (job.instagram_url as string).trim();
  const tempDir = path.join('/tmp', 'imports', jobId);
  const fullPath = path.join(tempDir, 'full.mp4');
  const clipsDir = path.join(tempDir, 'clips');

  const uploadedStorageRefs: string[] = [];

  const cleanup = async (deleteStorage = false) => {
    // Clean up local temp files
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
    // Clean up any uploaded storage files on error
    if (deleteStorage) {
      for (const ref of uploadedStorageRefs) {
        try {
          await getStorage().file(ref).delete();
        } catch {
          // ignore - file may not exist
        }
      }
    }
  };

  const metadata: InstagramMetadata = {
    url: instagramUrl,
  };

  try {
    // 1. Duplicate check
    const userSnap = await getDb().collection('users').doc(userId).get();
    const userData = userSnap.data();
    const analyzed = (userData?.analyzed_video_urls as string[]) || [];
    const normalizedUrl = instagramUrl.replace(/\/$/, '');
    if (analyzed.some((u) => u.replace(/\/$/, '') === normalizedUrl)) {
      const logId = await createAnalysisLog({
        jobId,
        userId,
        instagramUrl,
        metadata,
        promptUsed: 'N/A - duplicate',
        returnedJson: { duplicate: true },
        status: 'error',
        errorMessage: 'Already imported',
      });
      await setJobError(jobId, 'Already imported', logId);
      return;
    }

    // 2. invoked
    await updateJob(jobId, { status: 'invoked' });

    // 3. Download
    fs.mkdirSync(tempDir, { recursive: true });
    const cookiePath = await ensureCookieFile();
    const cookieOpts = cookiePath ? { cookies: cookiePath } : {};
    try {
      const info = await youtubedl(instagramUrl, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        ...cookieOpts,
      });
      Object.assign(metadata, parseMetadata(info as Record<string, unknown>, instagramUrl));

      await youtubedl(instagramUrl, {
        output: fullPath,
        noCheckCertificates: true,
        format: 'bestvideo[height<=720]+bestaudio/best[height<=720]/best',
        mergeOutputFormat: 'mp4',
        ...cookieOpts,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      const logId = await createAnalysisLog({
        jobId,
        userId,
        instagramUrl,
        metadata,
        promptUsed: 'N/A',
        returnedJson: { error: msg },
        status: 'error',
        errorMessage: msg,
      });
      await setJobError(jobId, 'Could not download video', logId);
      await cleanup(true);
      return;
    }

    if (!fs.existsSync(fullPath)) {
      const logId = await createAnalysisLog({
        jobId,
        userId,
        instagramUrl,
        metadata,
        promptUsed: 'N/A',
        returnedJson: { error: 'Video file not found after download' },
        status: 'error',
        errorMessage: 'Video file not found',
      });
      await setJobError(jobId, 'Download failed', logId);
      await cleanup(true);
      return;
    }

    const storageRefFull = `temp/imports/${jobId}/full.mp4`;
    await getStorage().upload(fullPath, { destination: storageRefFull });
    uploadedStorageRefs.push(storageRefFull);
    await updateJob(jobId, {
      status: 'v_downloaded',
      instagram_metadata: metadata,
      storage_ref_full: storageRefFull,
    });

    // 4. Analyze with Gemini (from functions/.env or Secret Manager)
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    });

    const videoBuffer = fs.readFileSync(fullPath);
    const base64 = videoBuffer.toString('base64');

    const userPrompt = `Analyze this Instagram fitness video.

Metadata:
- Author: @${metadata.author?.username || 'unknown'}
- Caption: "${(metadata.caption || '').substring(0, 200)}"
- Duration: ${metadata.duration_seconds || 0}s

Return the JSON schema.`;

    let analysis: AIAnalysisResult;
    try {
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'video/mp4',
            data: base64,
          },
        },
        { text: `${FITNESS_SYSTEM_PROMPT}\n\n${userPrompt}` },
      ]);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON in response');
      }
      analysis = JSON.parse(jsonMatch[0]) as AIAnalysisResult;
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : 'Analysis failed';
      const logId = await createAnalysisLog({
        jobId,
        userId,
        instagramUrl,
        storageRef: storageRefFull,
        metadata,
        promptUsed: FITNESS_SYSTEM_PROMPT + '\n\n' + userPrompt,
        returnedJson: { parseError: msg },
        status: 'error',
        errorMessage: msg,
      });
      await setJobError(jobId, 'Analysis failed', logId);
      await cleanup(true);
      return;
    }

    await createAnalysisLog({
      jobId,
      userId,
      instagramUrl,
      storageRef: storageRefFull,
      metadata,
      promptUsed: FITNESS_SYSTEM_PROMPT + '\n\n' + userPrompt,
      returnedJson: analysis,
      status: 'success',
    });

    if (!analysis.is_fitness_video || !analysis.has_exercises || !analysis.exercises?.length) {
      const reason =
        analysis.rejection_reason ||
        (!analysis.is_fitness_video ? 'Not a fitness video' : 'No exercises detected');
      await setJobError(jobId, reason);
      await cleanup(true);
      return;
    }

    await updateJob(jobId, { status: 'analyzed' });

    // 5. Cut clips with ffmpeg
    fs.mkdirSync(clipsDir, { recursive: true });
    const clipPaths: string[] = [];
    const storageRefClips: string[] = [];

    for (let i = 0; i < analysis.exercises.length; i++) {
      const ex = analysis.exercises[i];
      const start = Math.max(0, ex.timestamp_start);
      const end = Math.min(metadata.duration_seconds || 999, ex.timestamp_end);
      const duration = end - start;
      if (duration <= 0) continue;

      const clipPath = path.join(clipsDir, `${i}.mp4`);
      execSync(
        `"${ffmpegPath}" -y -i "${fullPath}" -ss ${start} -t ${duration} -c copy "${clipPath}"`,
        { stdio: 'pipe' }
      );
      if (!fs.existsSync(clipPath)) continue;

      const storageRef = `temp/imports/${jobId}/clips/${i}.mp4`;
      await getStorage().upload(clipPath, { destination: storageRef });
      uploadedStorageRefs.push(storageRef);
      clipPaths.push(clipPath);
      storageRefClips.push(storageRef);
    }

    // Delete full video from storage (keep clips)
    try {
      await getStorage().file(storageRefFull).delete();
    } catch {
      // ignore
    }

    // 6. Build exercises array with media URLs
    const signedUrlResults = await Promise.all(
      storageRefClips.map((ref) =>
        getStorage().file(ref).getSignedUrl({
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        })
      )
    );
    const signedUrls = signedUrlResults.map(([url]) => url);

    const exercises = analysis.exercises.map((ex, i) => ({
      index: i,
      name: ex.name,
      description: ex.description || '',
      type: ex.type || 'repeat',
      default_time_per_rep_secs: ex.default_time_per_rep_secs,
      chips: mapChipsToRegistry(ex.chips || []),
      timestamp_start: ex.timestamp_start,
      timestamp_end: ex.timestamp_end,
      media_url: signedUrls[i] || null,
      status: 'pending' as const,
    }));

    // Add URL to user's analyzed list
    await getDb().collection('users').doc(userId).update({
      analyzed_video_urls: admin.firestore.FieldValue.arrayUnion(normalizedUrl),
    });

    await updateJob(jobId, {
      status: 'await_approve',
      exercises,
      storage_ref_full: admin.firestore.FieldValue.delete(),
      storage_ref_clips: storageRefClips,
    });

    await cleanup();
  } catch (err) {
    functions.logger.error('Pipeline error', err);
    try {
      await setJobError(
        jobId,
        err instanceof Error ? err.message : 'Processing failed'
      );
    } catch (updateErr) {
      functions.logger.error('Failed to mark job as error — job may be stuck', updateErr);
    }
    await cleanup(true);
  }
}
