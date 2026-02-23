'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { MAX_VIDEO_DURATION_SECS } from '@/lib/utils/validators';

interface VideoTrimmerProps {
  videoFile: File;
  onTrim: (trimmedBlob: Blob) => void;
  onCancel: () => void;
}

export function VideoTrimmer({ videoFile, onTrim, onCancel }: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [videoUrl] = useState(() => URL.createObjectURL(videoFile));

  const maxClip = MAX_VIDEO_DURATION_SECS;
  const endTime = Math.min(startTime + maxClip, duration);

  useEffect(() => {
    return () => URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
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

  const handleTimelineDrag = useCallback(
    (clientX: number) => {
      const timeline = timelineRef.current;
      if (!timeline || duration <= 0) return;

      const rect = timeline.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const newStart = Math.max(0, pct * duration - maxClip / 2);
      const clamped = Math.min(newStart, Math.max(0, duration - maxClip));
      setStartTime(clamped);

      if (videoRef.current) {
        videoRef.current.currentTime = clamped;
      }
    },
    [duration, maxClip]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    handleTimelineDrag(e.clientX);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    handleTimelineDrag(e.clientX);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
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

      // Stop after clip duration
      setTimeout(() => {
        video.pause();
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, maxClip * 1000 + 200);

      const blob = await done;
      onTrim(blob);
    } catch (err) {
      console.error('Trim failed:', err);
      // Fallback: just pass original file
      onTrim(videoFile);
    } finally {
      setProcessing(false);
    }
  };

  const selectionLeft = duration > 0 ? (startTime / duration) * 100 : 0;
  const selectionWidth = duration > 0 ? (maxClip / duration) * 100 : 100;

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

      {/* Timeline */}
      <div className="flex-shrink-0 px-4 py-4 space-y-3">
        <div
          ref={timelineRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative h-12 bg-bg-elevated rounded-lg overflow-hidden cursor-pointer touch-none"
        >
          {/* Full track */}
          <div className="absolute inset-0 bg-fg-subtle/10" />

          {/* Selection window */}
          <motion.div
            className="absolute top-0 bottom-0 bg-accent/30 border-2 border-accent rounded"
            style={{
              left: `${selectionLeft}%`,
              width: `${selectionWidth}%`,
            }}
          >
            <div className="absolute left-0 top-0 bottom-0 w-3 bg-accent/50 rounded-l cursor-ew-resize" />
            <div className="absolute right-0 top-0 bottom-0 w-3 bg-accent/50 rounded-r cursor-ew-resize" />
          </motion.div>
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
