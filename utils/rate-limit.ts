import { NextFunction, Request, Response } from "express";

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

/**
 * Sliding-window rate limiter middleware factory.
 * Tracks request timestamps per IP address and rejects requests that
 * exceed `max` within the rolling `windowMs` period with HTTP 429.
 */
export function rateLimit({ windowMs, max }: RateLimitOptions) {
  const log = new Map<string, number[]>();

  // Periodically evict fully-expired entries to bound memory growth.
  const cleanup = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, timestamps] of log) {
      if (timestamps[timestamps.length - 1] < cutoff) {
        log.delete(key);
      }
    }
  }, windowMs);
  cleanup.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const cutoff = now - windowMs;

    const timestamps = (log.get(key) ?? []).filter(t => t > cutoff);
    if (timestamps.length >= max) {
      res.set("Retry-After", String(Math.ceil(windowMs / 1000)));
      res.set("Content-Type", "text/plain");
      return res.status(429).send("Too Many Requests");
    }
    timestamps.push(now);
    log.set(key, timestamps);
    next();
  };
}
