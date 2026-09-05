// Client-side rate limiting utilities

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs?: number;
}

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  blockedUntil?: number;
}

export class RateLimiter {
  private storage = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  isAllowed(key: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const entry = this.storage.get(key);

    if (!entry) {
      this.storage.set(key, { attempts: 1, firstAttempt: now });
      return { allowed: true };
    }

    if (entry.blockedUntil && now < entry.blockedUntil) {
      return { allowed: false, retryAfter: Math.ceil((entry.blockedUntil - now) / 1000) };
    }

    if (now - entry.firstAttempt > this.config.windowMs) {
      this.storage.set(key, { attempts: 1, firstAttempt: now });
      return { allowed: true };
    }

    entry.attempts++;

    if (entry.attempts > this.config.maxAttempts) {
      entry.blockedUntil = now + (this.config.blockDurationMs || this.config.windowMs);
      return { allowed: false, retryAfter: Math.ceil((entry.blockedUntil - now) / 1000) };
    }

    return { allowed: true };
  }

  reset(key: string): void {
    this.storage.delete(key);
  }

  getRemainingAttempts(key: string): number {
    const entry = this.storage.get(key);
    if (!entry) return this.config.maxAttempts;
    return Math.max(0, this.config.maxAttempts - entry.attempts);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.storage.entries()) {
      if (entry.blockedUntil && now > entry.blockedUntil) {
        this.storage.delete(key);
      } else if (now - entry.firstAttempt > this.config.windowMs) {
        this.storage.delete(key);
      }
    }
  }
}

export const loginLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 30 * 60 * 1000,
});

export const apiLimiter = new RateLimiter({
  maxAttempts: 100,
  windowMs: 60 * 1000,
});

export const passwordResetLimiter = new RateLimiter({
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000,
});
