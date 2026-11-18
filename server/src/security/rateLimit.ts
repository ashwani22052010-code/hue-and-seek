// Token-bucket rate limiting for sockets and HTTP.
import type { NextFunction, Request, Response } from 'express';

export class TokenBucket {
  private tokens: number;
  private last = Date.now();
  constructor(private ratePerSec: number, private burst: number) {
    this.tokens = burst;
  }
  take(n = 1): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.ratePerSec);
    this.last = now;
    if (this.tokens < n) return false;
    this.tokens -= n;
    return true;
  }
}

const LIMITS: Record<string, [number, number]> = {
  move: [30, 45],
  paint: [40, 80],
  tag: [4, 6],
  ability: [3, 5],
  chat: [0.7, 3],
  emote: [1, 3],
  room: [3, 8],
  misc: [5, 10],
};

/** Per-socket limiter set keyed by event category. */
export class SocketLimiter {
  private buckets = new Map<string, TokenBucket>();
  allow(category: string): boolean {
    let b = this.buckets.get(category);
    if (!b) {
      const [r, burst] = LIMITS[category] ?? LIMITS.misc;
      b = new TokenBucket(r, burst);
      this.buckets.set(category, b);
    }
    return b.take();
  }
}

/** Simple in-memory per-IP limiter middleware. */
export function httpLimiter(ratePerMin: number, burst: number) {
  const map = new Map<string, TokenBucket>();
  setInterval(() => { if (map.size > 50_000) map.clear(); }, 60_000).unref();
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? 'unknown';
    let b = map.get(ip);
    if (!b) map.set(ip, (b = new TokenBucket(ratePerMin / 60, burst)));
    if (!b.take()) {
      res.status(429).json({ error: 'Too many requests, slow down.' });
      return;
    }
    next();
  };
}
