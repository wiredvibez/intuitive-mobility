type AsyncFunction<T extends unknown[], R> = (...args: T) => Promise<R>;

interface RateLimiterOptions {
  minIntervalMs: number;
}

interface RateLimitedFunction<T extends unknown[], R> {
  (...args: T): Promise<R>;
  reset: () => void;
}

const lastCallTimes = new Map<string, number>();
const pendingCalls = new Map<string, Promise<unknown>>();

export function createRateLimitedFunction<T extends unknown[], R>(
  key: string,
  fn: AsyncFunction<T, R>,
  options: RateLimiterOptions
): RateLimitedFunction<T, R> {
  const rateLimited = async (...args: T): Promise<R> => {
    const now = Date.now();
    const lastCallTime = lastCallTimes.get(key) || 0;
    const timeSinceLastCall = now - lastCallTime;

    // If there's a pending call, wait for it instead of starting a new one
    const pending = pendingCalls.get(key);
    if (pending) {
      return pending as Promise<R>;
    }

    // If called too soon, skip this call
    if (timeSinceLastCall < options.minIntervalMs) {
      console.log(`Rate limited: ${key} (${timeSinceLastCall}ms since last call)`);
      throw new Error('Operation rate limited. Please wait a moment.');
    }

    lastCallTimes.set(key, now);

    const promise = fn(...args);
    pendingCalls.set(key, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      pendingCalls.delete(key);
    }
  };

  rateLimited.reset = () => {
    lastCallTimes.delete(key);
    pendingCalls.delete(key);
  };

  return rateLimited;
}

export function debounce<T extends unknown[]>(
  fn: (...args: T) => void,
  delayMs: number
): (...args: T) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: T) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
}

export function throttle<T extends unknown[]>(
  fn: (...args: T) => void,
  limitMs: number
): (...args: T) => void {
  let lastCallTime = 0;
  let pendingArgs: T | null = null;
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: T) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall >= limitMs) {
      lastCallTime = now;
      fn(...args);
    } else {
      pendingArgs = args;
      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          if (pendingArgs) {
            lastCallTime = Date.now();
            fn(...pendingArgs);
            pendingArgs = null;
          }
          timeoutId = null;
        }, limitMs - timeSinceLastCall);
      }
    }
  };
}
