'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { FlatBlock } from '../types';

const WINDOW_SIZE = 4; // current + next 3

export function useMediaBuffer(blocks: FlatBlock[], currentIndex: number) {
  const [bufferedUrls, setBufferedUrls] = useState<Map<string, string>>(new Map());
  const blobUrlsRef = useRef<Map<string, string>>(new Map());

  const bufferBlock = useCallback(async (block: FlatBlock) => {
    if (!block.media_url || blobUrlsRef.current.has(block.id)) return;

    try {
      const response = await fetch(block.media_url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      blobUrlsRef.current.set(block.id, blobUrl);
      setBufferedUrls(new Map(blobUrlsRef.current));
    } catch {
      // Use original URL on failure
      blobUrlsRef.current.set(block.id, block.media_url);
      setBufferedUrls(new Map(blobUrlsRef.current));
    }
  }, []);

  useEffect(() => {
    // Buffer current + next blocks
    const startIdx = currentIndex;
    const endIdx = Math.min(startIdx + WINDOW_SIZE, blocks.length);

    for (let i = startIdx; i < endIdx; i++) {
      const block = blocks[i];
      if (block?.media_url) {
        bufferBlock(block);
      }
    }

    // Evict old blocks
    const activeIds = new Set(
      blocks.slice(Math.max(0, startIdx - 1), endIdx).map((b) => b.id)
    );

    for (const [id, url] of blobUrlsRef.current) {
      if (!activeIds.has(id) && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
        blobUrlsRef.current.delete(id);
      }
    }

    setBufferedUrls(new Map(blobUrlsRef.current));
  }, [currentIndex, blocks, bufferBlock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const url of blobUrlsRef.current.values()) {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      }
    };
  }, []);

  const getBufferedUrl = useCallback(
    (blockId: string, fallbackUrl?: string) => {
      return bufferedUrls.get(blockId) || fallbackUrl || '';
    },
    [bufferedUrls]
  );

  return { getBufferedUrl };
}
