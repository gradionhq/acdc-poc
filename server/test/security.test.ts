import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { cspDirectives, securityOptions } from '../src/security';

describe('security headers (Helmet)', () => {
  it('sets a Content-Security-Policy header on API responses', async () => {
    const res = await request(createApp()).get('/api/health').expect(200);
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    // Same-origin default and external-only scripts (no 'unsafe-inline' for scripts).
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    // SPA needs inline styles (Vite-injected <style> tags).
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    // Hardening directives.
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("base-uri 'self'");
  });

  it('sets the standard Helmet hardening headers', async () => {
    const res = await request(createApp()).get('/api/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    // Helmet removes the framework fingerprint header.
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('applies the headers to JSON 404 responses too', async () => {
    const res = await request(createApp()).get('/api/does-not-exist').expect(404);
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('exposes the documented CSP directives via securityOptions', () => {
    const opts = securityOptions();
    expect(opts.contentSecurityPolicy).toMatchObject({ directives: cspDirectives });
    expect(cspDirectives['connect-src']).toEqual(["'self'"]);
  });
});
