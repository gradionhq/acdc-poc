import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { NoteStore } from './store.js';
import { createNotesRouter } from './notes.js';
import { createHealthRouter } from './health.js';
import { createOpenApiRouter } from './openapi.js';
import { requestLogger } from './logger.js';
import { createRateLimiter } from './rateLimiter.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// dist/src/app.js → ../../../web/dist  ;  src/app.ts (tsx dev) → ../../web/dist
const webDist = fs.existsSync(path.join(here, '../../../web/dist'))
  ? path.join(here, '../../../web/dist')
  : path.join(here, '../../web/dist');

export function createApp(store: NoteStore = new NoteStore()): Express {
  const app = express();

  // Request logging (quiet in test env).
  app.use(requestLogger);

  // Rate limiting — applied to /api/* only (static assets are not subject to limits).
  // GET /api/health is exempt from rate limiting (see exemptPaths in rateLimiter.ts).
  app.use('/api', createRateLimiter());

  app.use(express.json());

  // API first.
  app.use('/api/health', createHealthRouter());
  app.use('/api/openapi.json', createOpenApiRouter());
  app.use('/api/notes', createNotesRouter(store));
  // Test-only reset endpoint. Mounted ONLY when ENABLE_TEST_RESET=1 (set by the
  // e2e webServer). Never present in production — there is no way to enable it
  // without the env flag, so it cannot be reached by clients.
  if (process.env.ENABLE_TEST_RESET === '1') {
    app.post('/api/test/reset', (_req: Request, res: Response) => {
      store.reset();
      res.status(204).end();
    });
  }
  // Any other /api/* is a JSON 404 — never the SPA fallback.
  app.use('/api', (_req: Request, res: Response) => res.status(404).json({ error: 'not found' }));

  // Handle multer errors (file too large, rejected content type) as JSON 400.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'file too large' });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'internal server error' });
  });

  // Static SPA + history fallback (only when a build exists).
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (_req: Request, res: Response) => res.sendFile(path.join(webDist, 'index.html')));
  }
  return app;
}
