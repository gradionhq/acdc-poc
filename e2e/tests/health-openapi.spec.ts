import { test, expect } from '@playwright/test';

test.describe('Health and OpenAPI endpoints', () => {
  test('GET /api/health returns 200 with status ok and numeric uptime', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  test('GET /api/openapi.json returns valid JSON with openapi version field', async ({
    request,
  }) => {
    const res = await request.get('/api/openapi.json');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(typeof body.openapi).toBe('string');
    expect(body.openapi).toMatch(/^3\./);
    expect(body.info).toBeDefined();
    expect(body.paths).toBeDefined();
  });
});
