/** Validate Israeli phone number (digits only, after +972) */
export function validateIsraeliPhone(digits: string): boolean {
  const cleaned = digits.replace(/\D/g, '');
  return cleaned.length >= 9 && cleaned.length <= 10;
}

/** Validate exercise name */
export function validateExerciseName(name: string): string | null {
  if (!name.trim()) return 'Name is required';
  if (name.length > 60) return 'Name must be 60 characters or less';
  return null;
}

/** Validate user name */
export function validateUserName(name: string): string | null {
  if (!name.trim()) return 'Name is required';
  if (name.length > 50) return 'Name must be 50 characters or less';
  return null;
}

/** Validate routine name */
export function validateRoutineName(name: string): string | null {
  if (!name.trim()) return 'Give your routine a name';
  if (name.length > 80) return 'Name must be 80 characters or less';
  return null;
}

/** Check if a file is a video */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

/** Check if a file is an image */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/** Check if a file is a GIF */
export function isGifFile(file: File): boolean {
  return file.type === 'image/gif';
}

/** Get media type from file */
export function getMediaTypeFromFile(
  file: File
): 'video' | 'gif' | 'photo' {
  if (isVideoFile(file)) return 'video';
  if (isGifFile(file)) return 'gif';
  return 'photo';
}

/** Accepted media MIME types */
export const ACCEPTED_MEDIA_TYPES =
  'video/mp4,video/webm,video/quicktime,image/gif,image/png,image/jpeg,image/heic';

/** Max video duration in seconds */
export const MAX_VIDEO_DURATION_SECS = 15;

/** Get video duration */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video metadata'));
    };
    video.src = URL.createObjectURL(file);
  });
}

const INSTAGRAM_REEL_PATTERNS = [
  /^https?:\/\/(?:www\.)?instagram\.com\/reel\/([A-Za-z0-9_-]+)\/?/,
  /^https?:\/\/(?:www\.)?instagram\.com\/p\/([A-Za-z0-9_-]+)\/?/,
  /^https?:\/\/(?:www\.)?instagram\.com\/reels\/([A-Za-z0-9_-]+)\/?/,
];

/** Validate Instagram Reel URL */
export function validateInstagramUrl(
  url: string
): { valid: true; shortcode: string } | { valid: false; error: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'No URL provided' };
  }
  const trimmed = url.trim();
  try {
    new URL(trimmed);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
  if (!trimmed.includes('instagram.com')) {
    return { valid: false, error: 'Not an Instagram URL' };
  }
  for (const pattern of INSTAGRAM_REEL_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return { valid: true, shortcode: match[1] };
    }
  }
  return {
    valid: false,
    error: 'Not a valid Instagram Reel URL. Use format: https://www.instagram.com/reel/xxxxx/',
  };
}
