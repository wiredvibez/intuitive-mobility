'use client';

import { useRef, useEffect } from 'react';
import type { MediaType } from '@/lib/types';

interface MediaPlayerProps {
  mediaUrl?: string;
  mediaType?: MediaType;
  className?: string;
  isPlaying?: boolean;
  onClick?: () => void;
  showPlayOverlay?: boolean;
}

export function MediaPlayer({
  mediaUrl,
  mediaType,
  className = '',
  isPlaying = true,
  onClick,
  showPlayOverlay = false,
}: MediaPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && mediaUrl) {
      videoRef.current.load();
    }
  }, [mediaUrl]);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  if (!mediaUrl) {
    return (
      <div className={`bg-bg-elevated flex items-center justify-center ${className}`}>
        <div className="text-fg-subtle text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-2 opacity-30">
            <rect x="2" y="2" width="20" height="20" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
      </div>
    );
  }

  if (mediaType === 'video') {
    return (
      <div className={`relative ${className}`} onClick={onClick}>
        <video
          ref={videoRef}
          src={mediaUrl}
          muted
          loop
          playsInline
          autoPlay
          className="w-full h-full object-cover"
        />
        {showPlayOverlay && !isPlaying && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#000">
                <polygon points="8,5 19,12 8,19" />
              </svg>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <img
      src={mediaUrl}
      alt=""
      onClick={onClick}
      className={`object-cover ${className}`}
    />
  );
}
