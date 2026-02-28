'use client';

import { useEffect } from 'react';

export function OrientationLock() {
  useEffect(() => {
    const lockOrientation = async () => {
      try {
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (type: string) => Promise<void>;
        };
        if (orientation?.lock) {
          await orientation.lock('portrait');
        }
      } catch {
        // Orientation lock not supported or not allowed
        // This is expected on most mobile browsers unless in fullscreen/PWA mode
      }
    };

    lockOrientation();
  }, []);

  return null;
}
