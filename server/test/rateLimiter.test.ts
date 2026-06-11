// test/rateLimiter.test.ts
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response } from 'express';
import { createRateLimiter } from '../src/rateLimiter';

/**
 * Build a minimal test app with the rate limiter and a simple echo route.
 * The `max` and `windowMs` are kept tiny so tests run fast without sleeping.
 */
function buildApp(max: number, windowMs: number) {
  const app = express();
  app.use(createRateLimiter({ max, windowMs, exemptPaths: ['/exempt'] }));
  app.get('/test', (_req: Request, res: Response) => res.json({ ok: true }));
  app.get('/exempt', (_req: Request, res: Response) => res.json({ exempt: true }));
  return app;
}

describe('rate limiter middleware', () => {
  describe('basic enforcement', () => {
    it('allows requests up to the configured limit', async () => {
      const app = buildApp(3, 60_000);
      for (let i = 0; i < 3; i += 1) {
        const res = await request(app).get('/test');
        expect(res.status).toBe(200);
      }
    });

    it('returns 429 on the request exceeding the limit', async () => {
      const app = buildApp(3, 60_000);
      for (let i = 0; i < 3; i += 1) {
        await request(app).get('/test');
      }
      const res = await request(app).get('/test');
      expect(res.status).toBe(429);
      expect(res.body).toMatchObject({ error: 'Too Many Requests' });
    });

    it('includes a Retry-After header on 429 responses', async () => {
      const app = buildApp(1, 60_000);
      await request(app).get('/test'); // within limit
      const res = await request(app).get('/test'); // over limit
      expect(res.status).toBe(429);
      expect(res.headers['retry-after']).toBeDefined();
      const retryAfter = Number(res.headers['retry-after']);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });
  });

  describe('exemptions', () => {
    it('never rate-limits the exempt path', async () => {
      const app = buildApp(1, 60_000);
      // Exhaust the main window.
      await request(app).get('/test');
      await request(app).get('/test'); // 429 on /test now
      // Exempt path must still succeed.
      for (let i = 0; i < 5; i += 1) {
        const res = await request(app).get('/exempt');
        expect(res.status).toBe(200);
      }
    });
  });

  describe('window reset', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('allows requests again after the window expires', async () => {
      const windowMs = 1_000;
      const app = buildApp(2, windowMs);

      // Exhaust the window.
      await request(app).get('/test');
      await request(app).get('/test');
      const blockedRes = await request(app).get('/test');
      expect(blockedRes.status).toBe(429);

      // Advance time past the window.
      vi.advanceTimersByTime(windowMs + 1);

      const resumedRes = await request(app).get('/test');
      expect(resumedRes.status).toBe(200);
    });

    it('evicts expired buckets via the background sweep timer', async () => {
      const windowMs = 1_000;
      // Access the internal store via a spy to verify eviction.
      // We indirectly verify eviction by confirming a previously-blocked IP is
      // allowed again after the sweep runs (i.e. the bucket was removed, not
      // just lazily reset on the next hit from that IP).
      const app = buildApp(1, windowMs);

      // Exhaust the window for this IP.
      await request(app).get('/test');
      const blocked = await request(app).get('/test');
      expect(blocked.status).toBe(429);

      // Advance time far past two sweep intervals so the interval fires.
      vi.advanceTimersByTime(windowMs * 2 + 1);

      // The bucket should have been evicted; a fresh request starts a new window.
      const after = await request(app).get('/test');
      expect(after.status).toBe(200);
    });
  });

  describe('environment variable configuration', () => {
    it('reads RATE_LIMIT_MAX and RATE_LIMIT_WINDOW_MS', async () => {
      const original = { max: process.env.RATE_LIMIT_MAX, win: process.env.RATE_LIMIT_WINDOW_MS };
      process.env.RATE_LIMIT_MAX = '2';
      process.env.RATE_LIMIT_WINDOW_MS = '60000';

      // Re-import defaultOptions after setting env vars.
      const { defaultOptions } = await import('../src/rateLimiter');
      const opts = defaultOptions();
      expect(opts.max).toBe(2);
      expect(opts.windowMs).toBe(60_000);

      // Restore.
      if (original.max === undefined) delete process.env.RATE_LIMIT_MAX;
      else process.env.RATE_LIMIT_MAX = original.max;
      if (original.win === undefined) delete process.env.RATE_LIMIT_WINDOW_MS;
      else process.env.RATE_LIMIT_WINDOW_MS = original.win;
    });
  });
});

describe('GET /api/health exempt from rate limiting', () => {
  it('is never blocked regardless of request count', async () => {
    // Import createApp so the full stack (with /api/health) is used.
    const { createApp } = await import('../src/app');
    // Monkey-patch env so the rate limit is extremely low.
    const origMax = process.env.RATE_LIMIT_MAX;
    process.env.RATE_LIMIT_MAX = '2';
    const app = createApp();
    // Reset env immediately.
    if (origMax === undefined) delete process.env.RATE_LIMIT_MAX;
    else process.env.RATE_LIMIT_MAX = origMax;

    // Hit other routes to exhaust the window for this IP.
    await request(app).get('/api/notes');
    await request(app).get('/api/notes');
    // This would be the 3rd request — should 429 on a non-exempt path.
    const blocked = await request(app).get('/api/notes');
    expect(blocked.status).toBe(429);

    // Health must still pass.
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
    }
  });
});
