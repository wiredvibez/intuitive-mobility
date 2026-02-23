'use client';

import { useRef, useEffect } from 'react';
import type { MediaType } from '@/lib/types';

interface MediaPlayerProps {
  mediaUrl?: string;
  mediaType?: MediaType;
  className?: string;
}

export function MediaPlayer({ mediaUrl, mediaType, className = '' }: MediaPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && mediaUrl) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [mediaUrl]);

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
      <video
        ref={videoRef}
        src={mediaUrl}
        muted
        loop
        playsInline
        autoPlay
        className={`object-cover ${className}`}
      />
    );
  }

  return (
    <img
      src={mediaUrl}
      alt=""
      className={`object-cover ${className}`}
    />
  );
}
