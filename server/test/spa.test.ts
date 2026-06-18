import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp, mountSpa } from '../src/app';

describe('SPA serving', () => {
  it('returns 404 JSON for unknown /api routes (not the SPA fallback)', async () => {
    const res = await request(createApp()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
  });
});

describe('SPA static / history-fallback rate limiting', () => {
  // A fixture "build" so mountSpa has a real index.html + asset to serve
  // without running the web build.
  let webDist: string;

  beforeAll(() => {
    webDist = fs.mkdtempSync(path.join(os.tmpdir(), 'spa-fixture-'));
    fs.writeFileSync(path.join(webDist, 'index.html'), '<!doctype html><title>app</title>');
    fs.writeFileSync(path.join(webDist, 'app.js'), 'console.log("hi");');
  });

  afterAll(() => {
    fs.rmSync(webDist, { recursive: true, force: true });
  });

  /**
   * Build an app whose SPA block uses a low static limit (override for THIS
   * test only — see CLAUDE.md: prove 429 with a local override, not by
   * lowering the global default). Env is reset before mounting completes.
   */
  function buildSpaApp(max: number) {
    const orig = process.env.STATIC_RATE_LIMIT_MAX;
    process.env.STATIC_RATE_LIMIT_MAX = String(max);
    const app = express();
    try {
      mountSpa(app, webDist);
    } finally {
      if (orig === undefined) delete process.env.STATIC_RATE_LIMIT_MAX;
      else process.env.STATIC_RATE_LIMIT_MAX = orig;
    }
    return app;
  }

  it('serves the SPA fallback for unknown routes', async () => {
    const res = await request(buildSpaApp(100)).get('/some/client/route');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>app</title>');
  });

  it('does NOT throttle normal SPA/asset loads (many requests under the ceiling)', async () => {
    const app = buildSpaApp(100);
    // Simulate a page load fanning out into many asset requests.
    for (let i = 0; i < 40; i += 1) {
      const asset = await request(app).get('/app.js');
      expect(asset.status).toBe(200);
      const page = await request(app).get('/dashboard');
      expect(page.status).toBe(200);
    }
  });

  it('returns 429 once the history-fallback exceeds the limit', async () => {
    const app = buildSpaApp(3);
    for (let i = 0; i < 3; i += 1) {
      const ok = await request(app).get('/client/route');
      expect(ok.status).toBe(200);
    }
    const blocked = await request(app).get('/client/route');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ error: 'Too Many Requests' });
  });

  it('rate-limits the static-asset handler too (shared budget)', async () => {
    const app = buildSpaApp(2);
    expect((await request(app).get('/app.js')).status).toBe(200);
    expect((await request(app).get('/app.js')).status).toBe(200);
    // Third filesystem-backed request (asset or fallback) is over the limit.
    const blocked = await request(app).get('/app.js');
    expect(blocked.status).toBe(429);
  });
});
