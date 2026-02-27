import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as fs from 'fs';
import * as path from 'path';

export async function approveImportExercise(
  userId: string,
  jobId: string,
  exerciseIndex: number,
  edits: Record<string, unknown>
): Promise<{ exerciseId: string }> {
  const jobRef = admin.firestore().collection('video_import_jobs').doc(jobId);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Job not found');
  }
  const jobData = jobSnap.data()!;
  if (jobData.user_id !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Not your job');
  }

  const exercises = [...(jobData.exercises || [])];
  const idx = exercises.findIndex((e: { index: number }) => e.index === exerciseIndex);
  if (idx === -1) {
    throw new functions.https.HttpsError('not-found', 'Exercise not found');
  }
  const item = exercises[idx];
  if (item.status !== 'pending') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Exercise already approved or removed'
    );
  }

  const credit = jobData.instagram_metadata?.author?.username
    ? `@${jobData.instagram_metadata.author.username}`
    : undefined;

  const name = (edits.name as string) ?? item.name;
  const description = (edits.description as string) ?? item.description;
  const type = (edits.type as 'repeat' | 'timed') ?? item.type;
  const defaultTimePerRep = (edits.default_time_per_rep_secs as number) ?? item.default_time_per_rep_secs;
  const chips = (edits.chips as string[]) ?? item.chips ?? [];

  // Create exercise doc first to get ID
  const exerciseRef = admin.firestore().collection('exercises').doc();
  const exerciseId = exerciseRef.id;

  // Copy clip from temp to exercises/{userId}/{exerciseId}.mp4
  const tempRef = `temp/imports/${jobId}/clips/${exerciseIndex}.mp4`;
  const destRef = `exercises/${userId}/${exerciseId}.mp4`;

  const storage = admin.storage().bucket();
  const tempFile = storage.file(tempRef);

  const [tempExists] = await tempFile.exists();
  if (!tempExists) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Clip file not found'
    );
  }

  const tempPath = path.join('/tmp', `clip_${jobId}_${exerciseIndex}.mp4`);
  await tempFile.download({ destination: tempPath });
  await storage.upload(tempPath, { destination: destRef });
  try {
    fs.unlinkSync(tempPath);
  } catch {
    // ignore
  }

  await exerciseRef.set({
    id: exerciseId,
    author_id: userId,
    name,
    description,
    type,
    default_time_per_rep_secs: type === 'repeat' ? defaultTimePerRep : undefined,
    media_url: '', // Client resolves via media_storage_path
    media_storage_path: destRef,
    media_type: 'video',
    chips,
    is_public: false,
    credit: credit ?? null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  exercises[idx] = {
    ...item,
    status: 'approved',
    exercise_id: exerciseId,
  };

  const allDone = exercises.every((e: { status: string }) =>
    ['approved', 'removed'].includes(e.status)
  );

  await jobRef.update({
    exercises,
    status: allDone ? 'complete' : 'incomplete_approve',
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  if (allDone) {
    // Cleanup temp storage
    const clips = (jobData.storage_ref_clips as string[]) || [];
    await Promise.all(
      clips.map((ref) => admin.storage().bucket().file(ref).delete().catch(() => {}))
    );
  }

  return { exerciseId };
}
