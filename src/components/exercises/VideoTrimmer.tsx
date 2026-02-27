'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { MAX_VIDEO_DURATION_SECS } from '@/lib/utils/validators';

const MIN_CLIP_SECS = 0.5;

interface VideoTrimmerProps {
  videoFile: File;
  onTrim: (trimmedBlob: Blob) => void;
  onCancel: () => void;
}

type DragHandle = 'left' | 'right' | null;

export function VideoTrimmer({ videoFile, onTrim, onCancel }: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [dragHandle, setDragHandle] = useState<DragHandle>(null);
  const [processing, setProcessing] = useState(false);
  const [videoUrl] = useState(() => URL.createObjectURL(videoFile));

  const maxClip = MAX_VIDEO_DURATION_SECS;

  useEffect(() => {
    return () => URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    const dur = video.duration;
    setDuration(dur);

    if (dur <= maxClip) {
      setStartTime(0);
      setEndTime(dur);
    } else {
      setStartTime(0);
      setEndTime(maxClip);
    }
  };

  // Loop the preview within the selected range
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.currentTime >= endTime || video.currentTime < startTime) {
        video.currentTime = startTime;
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.currentTime = startTime;

    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [startTime, endTime]);

  const clientXToTime = useCallback(
    (clientX: number): number => {
      const timeline = timelineRef.current;
      if (!timeline || duration <= 0) return 0;

      const rect = timeline.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return pct * duration;
    },
    [duration]
  );

  const handleLeftDrag = useCallback(
    (clientX: number) => {
      const raw = clientXToTime(clientX);
      const minStart = Math.max(0, endTime - maxClip);
      const maxStart = endTime - MIN_CLIP_SECS;
      const newStart = Math.max(minStart, Math.min(maxStart, raw));
      setStartTime(newStart);

      if (videoRef.current) {
        videoRef.current.currentTime = newStart;
      }
    },
    [clientXToTime, endTime, maxClip]
  );

  const handleRightDrag = useCallback(
    (clientX: number) => {
      const raw = clientXToTime(clientX);
      const minEnd = startTime + MIN_CLIP_SECS;
      const maxEnd = Math.min(duration, startTime + maxClip);
      const newEnd = Math.max(minEnd, Math.min(maxEnd, raw));
      setEndTime(newEnd);

      if (videoRef.current) {
        videoRef.current.currentTime = newEnd;
      }
    },
    [clientXToTime, startTime, duration, maxClip]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    const handle = (e.target as HTMLElement).dataset.handle as DragHandle;
    if (handle === 'left' || handle === 'right') {
      setDragHandle(handle);
      if (handle === 'left') handleLeftDrag(e.clientX);
      else handleRightDrag(e.clientX);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragHandle) return;
    if (dragHandle === 'left') handleLeftDrag(e.clientX);
    else handleRightDrag(e.clientX);
  };

  const handlePointerUp = () => {
    setDragHandle(null);
  };

  const handleTrim = async () => {
    setProcessing(true);
    try {
      const video = videoRef.current!;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const done = new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          resolve(new Blob(chunks, { type: 'video/webm' }));
        };
      });

      video.currentTime = startTime;
      await new Promise((r) => {
        video.onseeked = r;
      });

      mediaRecorder.start();

      const clipDuration = endTime - startTime;

      const drawFrame = () => {
        if (video.currentTime >= endTime || video.paused) {
          mediaRecorder.stop();
          return;
        }
        ctx.drawImage(video, 0, 0);
        requestAnimationFrame(drawFrame);
      };

      video.play();
      drawFrame();

      setTimeout(() => {
        video.pause();
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, clipDuration * 1000 + 200);

      const blob = await done;
      onTrim(blob);
    } catch (err) {
      console.error('Trim failed:', err);
      onTrim(videoFile);
    } finally {
      setProcessing(false);
    }
  };

  const selectionLeft = duration > 0 ? (startTime / duration) * 100 : 0;
  const selectionWidth = duration > 0 ? ((endTime - startTime) / duration) * 100 : 100;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden max-h-[100dvh]">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={onCancel} className="text-fg-muted hover:text-foreground p-1">
          ✕
        </button>
        <span className="text-sm font-semibold">Trim Video</span>
        <div className="w-6" />
      </div>

      {/* Video preview */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-4 bg-black overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          muted
          playsInline
          autoPlay
          loop
          onLoadedMetadata={handleLoadedMetadata}
          className="max-w-full max-h-full rounded-lg object-contain"
        />
      </div>

      {/* Timeline - Instagram style */}
      <div className="flex-shrink-0 px-4 py-4 space-y-3">
        <div
          ref={timelineRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="relative h-14 bg-bg-elevated rounded-xl overflow-hidden touch-none select-none"
        >
          {/* Full track - dimmed */}
          <div className="absolute inset-0 bg-fg-subtle/20" />

          {/* Left dimmed region */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-black/40"
            style={{ width: `${selectionLeft}%` }}
          />

          {/* Selection - highlighted */}
          <div
            className="absolute top-0 bottom-0 border-y-2 border-accent bg-accent/25"
            style={{
              left: `${selectionLeft}%`,
              width: `${selectionWidth}%`,
            }}
          >
            {/* Left handle */}
            <div
              data-handle="left"
              className="absolute left-0 top-0 bottom-0 w-4 flex items-center justify-center cursor-ew-resize hover:bg-accent/30 active:bg-accent/40 transition-colors rounded-l"
              aria-label="Adjust start"
            >
              <div className="w-1 h-8 bg-white rounded-full shadow" />
            </div>
            {/* Right handle */}
            <div
              data-handle="right"
              className="absolute right-0 top-0 bottom-0 w-4 flex items-center justify-center cursor-ew-resize hover:bg-accent/30 active:bg-accent/40 transition-colors rounded-r"
              aria-label="Adjust end"
            >
              <div className="w-1 h-8 bg-white rounded-full shadow" />
            </div>
          </div>

          {/* Right dimmed region */}
          <div
            className="absolute top-0 right-0 bottom-0 bg-black/40"
            style={{ width: `${100 - selectionLeft - selectionWidth}%` }}
          />
        </div>

        {/* Time labels */}
        <div className="flex justify-between text-xs text-fg-muted">
          <span>{formatTime(startTime)}</span>
          <span className="text-accent font-medium">
            {formatTime(endTime - startTime)} selected
          </span>
          <span>{formatTime(duration)}</span>
        </div>

        <Button fullWidth onClick={handleTrim} loading={processing}>
          Done
        </Button>
      </div>

      {/* Hidden canvas for encoding */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
