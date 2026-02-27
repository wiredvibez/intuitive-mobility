import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { processVideoImportPipeline } from './processVideoImport';
import { approveImportExercise } from './approveImportExercise';

admin.initializeApp();

/**
 * Firestore trigger: when a video_import_jobs doc is created with status 'created',
 * run the full pipeline (download, analyze, cut clips).
 */
export const onVideoImportJobCreated = functions.firestore
  .document('video_import_jobs/{jobId}')
  .onCreate(async (snap, context) => {
    const job = snap.data();
    const jobId = context.params.jobId;

    if (job.status !== 'created') {
      return;
    }

    await processVideoImportPipeline(jobId, job);
  });

/**
 * Callable: approve an exercise from an import job.
 * Copies clip to exercises storage, creates exercise doc, updates job.
 */
export const approveImportExerciseCallable = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be signed in'
      );
    }
    const { jobId, exerciseIndex, edits } = data;
    if (!jobId || exerciseIndex === undefined) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'jobId and exerciseIndex required'
      );
    }
    return approveImportExercise(
      context.auth.uid,
      jobId,
      exerciseIndex,
      edits || {}
    );
  }
);

/**
 * Callable: remove an exercise from an import job.
 */
export const removeImportExerciseCallable = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be signed in'
      );
    }
    const { jobId, exerciseIndex } = data;
    if (!jobId || exerciseIndex === undefined) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'jobId and exerciseIndex required'
      );
    }
    const db = admin.firestore();
    const jobRef = db.collection('video_import_jobs').doc(jobId);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Job not found');
    }
    const jobData = jobSnap.data()!;
    if (jobData.user_id !== context.auth.uid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Not your job'
      );
    }
    const exercises = [...(jobData.exercises || [])];
    const idx = exercises.findIndex((e: { index: number }) => e.index === exerciseIndex);
    if (idx === -1) {
      throw new functions.https.HttpsError('not-found', 'Exercise not found');
    }
    exercises[idx] = { ...exercises[idx], status: 'removed' };
    await jobRef.update({
      exercises,
      status: exercises.every((e: { status: string }) =>
        ['approved', 'removed'].includes(e.status)
      )
        ? 'complete'
        : 'incomplete_approve',
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
  }
);

/**
 * Callable: dismiss/reject an import job (e.g. error card).
 */
export const rejectImportJobCallable = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be signed in'
      );
    }
    const { jobId } = data;
    if (!jobId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'jobId required'
      );
    }
    const db = admin.firestore();
    const jobRef = db.collection('video_import_jobs').doc(jobId);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Job not found');
    }
    const jobData = jobSnap.data()!;
    if (jobData.user_id !== context.auth.uid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Not your job'
      );
    }
    await jobRef.update({
      status: 'rejected',
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
  }
);
