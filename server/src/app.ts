import express, { type Express, type Request, type Response } from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { NoteStore } from './store.js';
import { createNotesRouter } from './notes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// dist/src/app.js → ../../../web/dist  ;  src/app.ts (tsx dev) → ../../web/dist
const webDist = fs.existsSync(path.join(here, '../../../web/dist'))
  ? path.join(here, '../../../web/dist')
  : path.join(here, '../../web/dist');

export function createApp(store: NoteStore = new NoteStore()): Express {
  const app = express();
  app.use(express.json());

  // API first.
  app.use('/api/notes', createNotesRouter(store));
  // Any other /api/* is a JSON 404 — never the SPA fallback.
  app.use('/api', (_req: Request, res: Response) => res.status(404).json({ error: 'not found' }));

  // Static SPA + history fallback (only when a build exists).
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (_req: Request, res: Response) => res.sendFile(path.join(webDist, 'index.html')));
  }
  return app;
}
