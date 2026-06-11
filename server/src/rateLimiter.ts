import { type Request, type Response, type NextFunction } from 'express';

/**
 * In-memory bucket for a single IP address.
 */
interface Bucket {
  count: number;
  windowStart: number;
}

/**
 * Options controlling the rate limiter behaviour.
 */
export interface RateLimiterOptions {
  /** Maximum requests allowed within the window. Defaults to RATE_LIMIT_MAX env var or 100. */
  max: number;
  /** Sliding-window duration in milliseconds. Defaults to RATE_LIMIT_WINDOW_MS env var or 60000. */
  windowMs: number;
  /** Paths that are completely exempt from rate limiting (exact match against req.path). */
  exemptPaths?: string[];
}

function readEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Build the default options, resolving values from environment variables.
 *
 * `exemptPaths` are matched against `req.path` inside the middleware.  When
 * the middleware is mounted at `/api` (i.e. `app.use('/api', limiter)`),
 * Express strips the mount prefix, so the health path becomes `/health`.
 */
export function defaultOptions(): RateLimiterOptions {
  return {
    max: readEnvInt('RATE_LIMIT_MAX', 100),
    windowMs: readEnvInt('RATE_LIMIT_WINDOW_MS', 60_000),
    exemptPaths: ['/health'],
  };
}

/**
 * Create a per-IP in-memory rate-limiting middleware.
 *
 * The store resets on server restart (in-memory only, no external service).
 * `GET /api/health` (and any other path listed in `exemptPaths`) is exempt.
 *
 * **Deployment note — trust proxy:** `req.ip` resolves to the remote socket
 * address by default.  When the server is deployed behind a reverse proxy or
 * load balancer, call `app.set('trust proxy', <hops>)` so Express reads the
 * real client IP from `X-Forwarded-For`.  Only trust the number of proxy hops
 * you control; trusting all forwarded headers lets clients spoof IPs and bypass
 * the limit (or pollute the store with arbitrary keys).
 */
export function createRateLimiter(
  opts: Partial<RateLimiterOptions> = {},
): (req: Request, res: Response, next: NextFunction) => void {
  const { max, windowMs, exemptPaths } = { ...defaultOptions(), ...opts };
  const exempt = new Set(exemptPaths ?? []);
  const store = new Map<string, Bucket>();

  // Periodically evict expired buckets so the map cannot grow unbounded.
  // An IP that makes one request and never returns would otherwise leave its
  // bucket in memory for the lifetime of the process.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [ip, b] of store) {
      if (now - b.windowStart >= windowMs) store.delete(ip);
    }
  }, windowMs);
  // Don't keep the Node.js process alive just for the sweep timer.
  sweep.unref?.();

  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    // Skip exempt paths.
    if (exempt.has(req.path)) {
      next();
      return;
    }

    const ip = req.ip ?? 'unknown';
    const now = Date.now();

    let bucket = store.get(ip);
    if (bucket === undefined || now - bucket.windowStart >= windowMs) {
      // Start a fresh window.
      bucket = { count: 1, windowStart: now };
      store.set(ip, bucket);
      next();
      return;
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfterMs = windowMs - (now - bucket.windowStart);
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      res.set('Retry-After', String(retryAfterSec));
      res.status(429).json({ error: 'Too Many Requests' });
      return;
    }

    next();
  };
}
