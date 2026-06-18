import { type RequestHandler } from 'express';
import helmet, { type HelmetOptions } from 'helmet';

/**
 * Content-Security-Policy directives for the bundled SPA.
 *
 * The server serves a Vite-built single-page app (an external ES-module bundle
 * plus hashed CSS/asset files) from `web/dist`, alongside the JSON API. The
 * policy below is the tightest set of directives that keeps that SPA working:
 *
 * - `default-src 'self'`        — same-origin by default for anything not listed.
 * - `script-src 'self'`         — the app bundle is an external module
 *                                 (`<script type="module" src=...>`); no inline
 *                                 scripts are used, so inline scripts stay blocked.
 * - `style-src 'self' 'unsafe-inline'`
 *                               — styles are CSS Modules emitted as external
 *                                 stylesheets, but Vite (and some component
 *                                 libraries) may inject `<style>` tags at
 *                                 runtime, so inline styles are permitted.
 * - `img-src 'self' data:`      — same-origin images plus inline `data:` URIs
 *                                 (icons / small embedded assets).
 * - `font-src 'self' data:`     — same-origin and inline `data:` fonts.
 * - `connect-src 'self'`        — the SPA only calls its own `/api` endpoints.
 * - `object-src 'none'`         — disallow `<object>`/`<embed>` plugins.
 * - `frame-ancestors 'self'`    — clickjacking protection (no foreign framing).
 * - `base-uri 'self'`           — prevent `<base>` tag hijacking.
 * - `form-action 'self'`        — forms may only submit to the same origin.
 *
 * Keep this in sync with how the web app loads scripts/styles: if the SPA
 * starts loading assets from another origin, add that origin here rather than
 * relaxing a directive to a wildcard.
 */
export const cspDirectives: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'frame-ancestors': ["'self'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

/**
 * Build the Helmet options used by {@link createSecurityMiddleware}.
 *
 * Helmet's defaults are kept (HSTS, X-Content-Type-Options, no-sniff, etc.); we
 * only override the Content-Security-Policy so it is explicit and SPA-aware.
 */
export function securityOptions(): HelmetOptions {
  return {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: cspDirectives,
    },
  };
}

/**
 * Create the Helmet security-headers middleware.
 *
 * Sets a hardened set of HTTP security headers (Content-Security-Policy,
 * Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy, etc.) on
 * every response. The CSP is tuned for the bundled SPA — see {@link cspDirectives}.
 */
export function createSecurityMiddleware(): RequestHandler {
  return helmet(securityOptions());
}
