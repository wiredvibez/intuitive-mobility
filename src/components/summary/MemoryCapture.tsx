'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';

interface CapturedMedia {
  id: string;
  blob: Blob;
  type: 'photo' | 'video';
  previewUrl: string;
}

interface MemoryCaptureProps {
  captures: CapturedMedia[];
  onCapture: (media: CapturedMedia) => void;
  onRemove: (id: string) => void;
}

export function MemoryCapture({ captures, onCapture, onRemove }: MemoryCaptureProps) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [previewItem, setPreviewItem] = useState<CapturedMedia | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraOpen(true);
    } catch (err) {
      console.error('Camera access failed:', err);
      // Fallback: use file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,video/*';
      input.capture = 'environment';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const isVideo = file.type.startsWith('video/');
          const media: CapturedMedia = {
            id: Date.now().toString(36),
            blob: file,
            type: isVideo ? 'video' : 'photo',
            previewUrl: URL.createObjectURL(file),
          };
          onCapture(media);
        }
      };
      input.click();
    }
  }, [facingMode, onCapture]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }, []);

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const media: CapturedMedia = {
          id: Date.now().toString(36),
          blob,
          type: 'photo',
          previewUrl: URL.createObjectURL(blob),
        };
        onCapture(media);
      }
    }, 'image/jpeg', 0.85);
  }, [onCapture]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    try {
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm',
      });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const media: CapturedMedia = {
          id: Date.now().toString(36),
          blob,
          type: 'video',
          previewUrl: URL.createObjectURL(blob),
        };
        onCapture(media);
        setIsRecording(false);
        setRecordProgress(0);
      };

      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);

      // Progress animation (3 seconds)
      let elapsed = 0;
      recordTimerRef.current = setInterval(() => {
        elapsed += 100;
        setRecordProgress(Math.min(elapsed / 3000, 1));
        if (elapsed >= 3000) {
          recorder.stop();
          if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        }
      }, 100);
    } catch {
      // MediaRecorder not supported, take photo instead
      takePhoto();
    }
  }, [onCapture, takePhoto]);

  const handleShutterDown = () => {
    pressTimerRef.current = setTimeout(() => {
      startRecording();
    }, 300);
  };

  const handleShutterUp = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }

    if (isRecording) {
      // Stop recording
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.stop();
      }
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    } else {
      // Take photo
      takePhoto();
    }
  };

  const flipCamera = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    stopCamera();
    // Re-open with new facing mode
    setTimeout(() => startCamera(), 100);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
        Capture a Memory
      </h3>

      {!cameraOpen ? (
        <button
          onClick={startCamera}
          className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-border hover:border-fg-subtle flex flex-col items-center justify-center gap-2 text-fg-muted transition-colors"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <span className="text-xs">
            Tap: Photo · Hold: Video
          </span>
        </button>
      ) : (
        <div className="relative rounded-xl overflow-hidden bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full aspect-[4/3] object-cover"
          />

          {/* Controls */}
          <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-8">
            <button
              onClick={stopCamera}
              className="text-white/70 text-sm font-medium"
            >
              ✕ Cancel
            </button>

            {/* Shutter */}
            <div className="relative">
              {/* Progress ring for video */}
              {isRecording && (
                <svg
                  className="absolute -inset-1 w-[60px] h-[60px] -rotate-90"
                  viewBox="0 0 52 52"
                >
                  <circle
                    cx="26"
                    cy="26"
                    r="23"
                    fill="none"
                    stroke="red"
                    strokeWidth="3"
                    strokeDasharray={`${recordProgress * 144.5} 144.5`}
                    strokeLinecap="round"
                  />
                </svg>
              )}
              <button
                onPointerDown={handleShutterDown}
                onPointerUp={handleShutterUp}
                onPointerLeave={handleShutterUp}
                className={`
                  w-14 h-14 rounded-full border-4 border-white flex items-center justify-center
                  ${isRecording ? 'bg-red-500' : 'bg-white/20'}
                `}
              >
                {isRecording && (
                  <div className="w-5 h-5 rounded-sm bg-white" />
                )}
              </button>
            </div>

            <button
              onClick={flipCamera}
              className="text-white/70 text-sm font-medium"
            >
              🔄 Flip
            </button>
          </div>
        </div>
      )}

      {/* Captured thumbnails */}
      {captures.length > 0 && (
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {captures.map((media) => (
            <button
              key={media.id}
              onClick={() => setPreviewItem(media)}
              className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-bg-elevated relative"
            >
              {media.type === 'video' ? (
                <video src={media.previewUrl} muted className="w-full h-full object-cover" />
              ) : (
                <img src={media.previewUrl} alt="" className="w-full h-full object-cover" />
              )}
              <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center">
                <span className="text-[8px] text-white">
                  {media.type === 'video' ? '🎬' : '🖼'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewItem && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="max-w-sm w-full">
            {previewItem.type === 'video' ? (
              <video
                src={previewItem.previewUrl}
                muted
                loop
                autoPlay
                playsInline
                className="w-full rounded-xl"
              />
            ) : (
              <img
                src={previewItem.previewUrl}
                alt=""
                className="w-full rounded-xl"
              />
            )}
          </div>
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setPreviewItem(null)}
              className="px-6 py-2.5 rounded-xl bg-bg-elevated text-sm font-medium text-foreground"
            >
              Close
            </button>
            <button
              onClick={() => {
                onRemove(previewItem.id);
                setPreviewItem(null);
              }}
              className="px-6 py-2.5 rounded-xl bg-danger text-sm font-medium text-white"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

export type { CapturedMedia };
