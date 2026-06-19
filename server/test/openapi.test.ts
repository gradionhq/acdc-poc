// test/openapi.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { docsEnabled, openApiSpec, validateOpenApiSpec } from '../src/openapi';

describe('validateOpenApiSpec', () => {
  it('accepts the served spec and returns it', () => {
    expect(validateOpenApiSpec()).toBe(openApiSpec);
  });

  it('documents every implemented route', () => {
    const paths = openApiSpec.paths as Record<string, Record<string, unknown>>;
    const expected: Array<[string, string]> = [
      ['/health', 'get'],
      ['/openapi.json', 'get'],
      ['/notes', 'get'],
      ['/notes', 'post'],
      ['/notes/trash', 'get'],
      ['/notes/{id}', 'get'],
      ['/notes/{id}', 'put'],
      ['/notes/{id}', 'delete'],
      ['/notes/{id}/restore', 'patch'],
      ['/notes/{id}/permanent', 'delete'],
      ['/notes/{id}/duplicate', 'post'],
      ['/notes/{id}/pin', 'patch'],
      ['/notes/{id}/archive', 'patch'],
      ['/notes/{id}/attachments', 'get'],
      ['/notes/{id}/attachments', 'post'],
      ['/notes/{id}/attachments/{name}', 'get'],
      ['/notes/{id}/attachments/{name}', 'delete'],
      ['/tags', 'get'],
      ['/tags/rename', 'post'],
      ['/tags/merge', 'post'],
      ['/tags/{name}', 'put'],
      ['/tags/{name}', 'delete'],
    ];
    for (const [path, method] of expected) {
      expect(paths[path], `missing path ${path}`).toBeDefined();
      expect(paths[path][method], `missing ${method} ${path}`).toBeDefined();
    }
  });

  it('throws when the openapi version is invalid', () => {
    const bad = { ...openApiSpec, openapi: '2.0' };
    expect(() => validateOpenApiSpec(bad as typeof openApiSpec)).toThrow(/3\.x/);
  });

  it('throws when info is incomplete', () => {
    const bad = { ...openApiSpec, info: { title: 'x' } };
    expect(() => validateOpenApiSpec(bad as unknown as typeof openApiSpec)).toThrow(/info/);
  });

  it('throws when there are no paths', () => {
    const bad = { ...openApiSpec, paths: {} };
    expect(() => validateOpenApiSpec(bad as typeof openApiSpec)).toThrow(/path/);
  });

  it('throws on an unresolved $ref', () => {
    const bad = {
      ...openApiSpec,
      paths: { '/x': { get: { responses: { '200': { $ref: '#/components/responses/Nope' } } } } },
    };
    expect(() => validateOpenApiSpec(bad as unknown as typeof openApiSpec)).toThrow(/unresolved/);
  });

  it('throws on a non-local $ref', () => {
    const bad = {
      ...openApiSpec,
      paths: { '/x': { get: { responses: { '200': { $ref: 'http://example/x' } } } } },
    };
    expect(() => validateOpenApiSpec(bad as unknown as typeof openApiSpec)).toThrow(/local/);
  });
});

describe('docsEnabled', () => {
  it('is on outside production', () => {
    expect(docsEnabled({ NODE_ENV: 'development' })).toBe(true);
  });

  it('is off in production by default', () => {
    expect(docsEnabled({ NODE_ENV: 'production' })).toBe(false);
  });

  it('honours the ENABLE_API_DOCS=1 override in production', () => {
    expect(docsEnabled({ NODE_ENV: 'production', ENABLE_API_DOCS: '1' })).toBe(true);
  });

  it('honours the ENABLE_API_DOCS=0 override outside production', () => {
    expect(docsEnabled({ NODE_ENV: 'development', ENABLE_API_DOCS: '0' })).toBe(false);
  });
});

describe('GET /api/docs (Swagger UI)', () => {
  const original = process.env.ENABLE_API_DOCS;
  afterEach(() => {
    if (original === undefined) delete process.env.ENABLE_API_DOCS;
    else process.env.ENABLE_API_DOCS = original;
  });

  it('serves an HTML page when docs are enabled', async () => {
    process.env.ENABLE_API_DOCS = '1';
    const app = createApp();
    const res = await request(app).get('/api/docs/').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toMatch(/swagger-ui/i);
  });

  it('serves the Swagger UI bundle assets when enabled', async () => {
    process.env.ENABLE_API_DOCS = '1';
    const app = createApp();
    await request(app).get('/api/docs/swagger-ui-init.js').expect(200);
  });

  it('returns 404 for the docs route when docs are disabled', async () => {
    process.env.ENABLE_API_DOCS = '0';
    const app = createApp();
    const res = await request(app).get('/api/docs/').expect(404);
    expect(res.body).toEqual({ error: 'not found' });
  });
});

describe('GET /api/openapi.json (served spec)', () => {
  beforeEach(() => {
    process.env.ENABLE_API_DOCS = '1';
  });

  it('serves a structurally valid spec', async () => {
    const app = createApp();
    const res = await request(app).get('/api/openapi.json').expect(200);
    expect(() => validateOpenApiSpec(res.body)).not.toThrow();
  });
});
