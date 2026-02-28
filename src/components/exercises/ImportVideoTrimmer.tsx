'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { XIcon } from '@/components/ui/Icons';

const MIN_CLIP_SECS = 0.5;

interface ImportVideoTrimmerProps {
  videoUrl: string;
  initialStart?: number;
  initialEnd?: number;
  onTrim: (trimmedBlob: Blob, newStart: number, newEnd: number) => void;
  onCancel: () => void;
}

type DragHandle = 'left' | 'right' | 'center' | null;

export function ImportVideoTrimmer({
  videoUrl,
  initialStart = 0,
  initialEnd,
  onTrim,
  onCancel,
}: ImportVideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(initialEnd || 0);
  const [dragHandle, setDragHandle] = useState<DragHandle>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTimes, setDragStartTimes] = useState({ start: 0, end: 0 });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      const dur = video.duration;
      setDuration(dur);
      if (!initialEnd || initialEnd > dur) {
        setEndTime(dur);
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata);
  }, [initialEnd]);

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
      const maxStart = endTime - MIN_CLIP_SECS;
      const newStart = Math.max(0, Math.min(maxStart, raw));
      setStartTime(newStart);

      if (videoRef.current) {
        videoRef.current.currentTime = newStart;
      }
    },
    [clientXToTime, endTime]
  );

  const handleRightDrag = useCallback(
    (clientX: number) => {
      const raw = clientXToTime(clientX);
      const minEnd = startTime + MIN_CLIP_SECS;
      const newEnd = Math.max(minEnd, Math.min(duration, raw));
      setEndTime(newEnd);

      if (videoRef.current) {
        videoRef.current.currentTime = newEnd;
      }
    },
    [clientXToTime, startTime, duration]
  );

  const handleCenterDrag = useCallback(
    (clientX: number) => {
      const timeline = timelineRef.current;
      if (!timeline || duration <= 0) return;

      const rect = timeline.getBoundingClientRect();
      const deltaX = clientX - dragStartX;
      const deltaPct = deltaX / rect.width;
      const deltaTime = deltaPct * duration;

      const clipLength = dragStartTimes.end - dragStartTimes.start;
      let newStart = dragStartTimes.start + deltaTime;
      let newEnd = dragStartTimes.end + deltaTime;

      if (newStart < 0) {
        newStart = 0;
        newEnd = clipLength;
      }
      if (newEnd > duration) {
        newEnd = duration;
        newStart = duration - clipLength;
      }

      setStartTime(newStart);
      setEndTime(newEnd);

      if (videoRef.current) {
        videoRef.current.currentTime = newStart;
      }
    },
    [dragStartX, dragStartTimes, duration]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    const handle = (e.target as HTMLElement).dataset.handle as DragHandle;
    if (handle === 'left' || handle === 'right' || handle === 'center') {
      setDragHandle(handle);
      setDragStartX(e.clientX);
      setDragStartTimes({ start: startTime, end: endTime });

      if (handle === 'left') handleLeftDrag(e.clientX);
      else if (handle === 'right') handleRightDrag(e.clientX);

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragHandle) return;
    if (dragHandle === 'left') handleLeftDrag(e.clientX);
    else if (dragHandle === 'right') handleRightDrag(e.clientX);
    else if (dragHandle === 'center') handleCenterDrag(e.clientX);
  };

  const handlePointerUp = () => {
    setDragHandle(null);
    setDragStartX(0);
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
      onTrim(blob, startTime, endTime);
    } catch (err) {
      console.error('Trim failed:', err);
    } finally {
      setProcessing(false);
    }
  };

  const selectionLeft = duration > 0 ? (startTime / duration) * 100 : 0;
  const selectionWidth = duration > 0 ? ((endTime - startTime) / duration) * 100 : 100;

  return (
    <div className="fixed inset-0 z-[70] bg-background flex flex-col overflow-hidden pt-safe-t pb-safe-b">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={onCancel} className="text-fg-muted hover:text-foreground p-1">
          <XIcon size={18} />
        </button>
        <span className="text-sm font-semibold">Edit Clip</span>
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
          crossOrigin="anonymous"
          className="max-w-full max-h-full rounded-lg object-contain"
        />
      </div>

      {/* Timeline */}
      <div className="flex-shrink-0 px-4 py-4 space-y-3">
        <div
          ref={timelineRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="relative h-14 bg-bg-elevated rounded-xl overflow-hidden touch-none select-none"
        >
          <div className="absolute inset-0 bg-fg-subtle/20" />

          <div
            className="absolute top-0 bottom-0 left-0 bg-black/40"
            style={{ width: `${selectionLeft}%` }}
          />

          <div
            className="absolute top-0 bottom-0 border-y-2 border-accent bg-accent/25"
            style={{
              left: `${selectionLeft}%`,
              width: `${selectionWidth}%`,
            }}
          >
            <div
              data-handle="left"
              className="absolute left-0 top-0 bottom-0 w-4 flex items-center justify-center cursor-ew-resize hover:bg-accent/30 active:bg-accent/40 transition-colors rounded-l z-10"
              aria-label="Adjust start"
            >
              <div className="w-1 h-8 bg-white rounded-full shadow pointer-events-none" />
            </div>
            <div
              data-handle="center"
              className="absolute left-4 right-4 top-0 bottom-0 cursor-grab active:cursor-grabbing hover:bg-accent/10 transition-colors"
              aria-label="Move selection"
            />
            <div
              data-handle="right"
              className="absolute right-0 top-0 bottom-0 w-4 flex items-center justify-center cursor-ew-resize hover:bg-accent/30 active:bg-accent/40 transition-colors rounded-r z-10"
              aria-label="Adjust end"
            >
              <div className="w-1 h-8 bg-white rounded-full shadow pointer-events-none" />
            </div>
          </div>

          <div
            className="absolute top-0 right-0 bottom-0 bg-black/40"
            style={{ width: `${100 - selectionLeft - selectionWidth}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-fg-muted">
          <span>{formatTime(startTime)}</span>
          <span className="text-accent font-medium">
            {formatTime(endTime - startTime)} selected
          </span>
          <span>{formatTime(duration)}</span>
        </div>

        <Button fullWidth onClick={handleTrim} loading={processing}>
          Apply Changes
        </Button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
