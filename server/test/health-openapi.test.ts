// test/health-openapi.test.ts
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /api/health', () => {
  it('returns 200 with status ok and uptime number', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('does not require authentication (no auth headers needed)', async () => {
    const app = createApp();
    // No auth header — must still return 200
    await request(app).get('/api/health').expect(200);
  });
});

describe('GET /api/openapi.json', () => {
  it('returns 200 with valid JSON containing openapi version field', async () => {
    const app = createApp();
    const res = await request(app).get('/api/openapi.json').expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(typeof res.body).toBe('object');
    expect(typeof res.body.openapi).toBe('string');
    expect(res.body.openapi).toMatch(/^3\./);
  });

  it('spec has info.title and info.version', async () => {
    const app = createApp();
    const res = await request(app).get('/api/openapi.json').expect(200);
    expect(res.body.info).toBeDefined();
    expect(typeof res.body.info.title).toBe('string');
    expect(typeof res.body.info.version).toBe('string');
  });

  it('spec documents /notes path', async () => {
    const app = createApp();
    const res = await request(app).get('/api/openapi.json').expect(200);
    expect(res.body.paths).toBeDefined();
    expect(res.body.paths['/notes']).toBeDefined();
    expect(res.body.paths['/notes'].get).toBeDefined();
    expect(res.body.paths['/notes'].post).toBeDefined();
  });

  it('spec documents /notes/{id} path with get, put, delete', async () => {
    const app = createApp();
    const res = await request(app).get('/api/openapi.json').expect(200);
    expect(res.body.paths['/notes/{id}']).toBeDefined();
    expect(res.body.paths['/notes/{id}'].get).toBeDefined();
    expect(res.body.paths['/notes/{id}'].put).toBeDefined();
    expect(res.body.paths['/notes/{id}'].delete).toBeDefined();
  });

  it('spec documents attachment routes', async () => {
    const app = createApp();
    const res = await request(app).get('/api/openapi.json').expect(200);
    expect(res.body.paths['/notes/{id}/attachments']).toBeDefined();
    expect(res.body.paths['/notes/{id}/attachments/{name}']).toBeDefined();
  });

  it('spec documents /health path', async () => {
    const app = createApp();
    const res = await request(app).get('/api/openapi.json').expect(200);
    expect(res.body.paths['/health']).toBeDefined();
    expect(res.body.paths['/health'].get).toBeDefined();
  });

  it('spec has components with Note schema', async () => {
    const app = createApp();
    const res = await request(app).get('/api/openapi.json').expect(200);
    expect(res.body.components?.schemas?.Note).toBeDefined();
  });
});
