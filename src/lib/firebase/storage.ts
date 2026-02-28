import {
  ref,
  uploadBytes,
  getDownloadURL as fbGetDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from './config';

export async function uploadExerciseMedia(
  userId: string,
  file: File | Blob,
  exerciseId: string
): Promise<{ url: string; path: string }> {
  // Determine extension from file name or MIME type
  let ext = 'mp4';
  if (file instanceof File) {
    ext = file.name.split('.').pop() || 'mp4';
  } else if (file.type) {
    // Extract extension from MIME type (e.g., 'video/webm' -> 'webm')
    const mimeExt = file.type.split('/')[1]?.split(';')[0];
    if (mimeExt) ext = mimeExt;
  }
  
  const path = `exercises/${userId}/${exerciseId}.${ext}`;
  const storageRef = ref(storage, path);
  
  // Add timeout to prevent hanging
  const uploadPromise = uploadBytes(storageRef, file);
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Upload timeout')), 60000)
  );
  
  await Promise.race([uploadPromise, timeoutPromise]);
  const url = await fbGetDownloadURL(storageRef);
  return { url, path };
}

export async function uploadMemoryMedia(
  userId: string,
  archiveId: string,
  file: Blob,
  fileName: string
): Promise<{ url: string; path: string }> {
  const path = `users/${userId}/memories/${archiveId}/${fileName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await fbGetDownloadURL(storageRef);
  return { url, path };
}

export async function deleteMedia(path: string) {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (err) {
    console.warn('Failed to delete media:', path, err);
  }
}

export async function getDownloadURL(path: string): Promise<string> {
  const storageRef = ref(storage, path);
  return fbGetDownloadURL(storageRef);
}

/** Resolve exercise media URL (handles media_storage_path for imported exercises) */
export async function getExerciseMediaUrl(exercise: {
  media_url?: string;
  media_storage_path?: string;
}): Promise<string> {
  if (exercise.media_url) return exercise.media_url;
  if (exercise.media_storage_path) {
    return getDownloadURL(exercise.media_storage_path);
  }
  return '';
}
