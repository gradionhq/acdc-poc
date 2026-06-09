import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import type { NoteStore } from './store.js';

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : fallback;
}

// Cap upload size and accept a single field, in memory only — we never write
// client-supplied bytes (or names) to the filesystem.
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function createNotesRouter(store: NoteStore): Router {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  }).single('file');

  router.get('/', (req: Request, res: Response) => {
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.pageSize, 10);
    const result = store.list(page, pageSize);
    res.set('X-Total-Count', String(result.total));
    res.json(result.items);
  });

  router.post('/', (req: Request, res: Response) => {
    const { title, body } = (req.body ?? {}) as { title?: unknown; body?: unknown };
    if (typeof title !== 'string' || typeof body !== 'string') {
      res.status(400).json({ error: 'title and body must be strings' });
      return;
    }
    res.status(201).json(store.create({ title, body }));
  });

  router.get('/:id', (req: Request, res: Response) => {
    const note = store.get(req.params.id);
    if (!note) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(note);
  });

  router.put('/:id', (req: Request, res: Response) => {
    const { title, body } = (req.body ?? {}) as { title?: string; body?: string };
    const note = store.update(req.params.id, { title, body });
    if (!note) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(note);
  });

  router.delete('/:id', (req: Request, res: Response) => {
    if (!store.delete(req.params.id)) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.status(204).end();
  });

  router.post('/:id/attachments', (req: Request, res: Response) => {
    upload(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json({ error: 'invalid file upload' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'file field is required' });
        return;
      }
      const meta = store.addAttachment(req.params.id, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
        data: req.file.buffer,
      });
      if (!meta) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      res.status(201).json(meta);
    });
  });

  router.get('/:id/attachments/:name', (req: Request, res: Response) => {
    const stored = store.getAttachment(req.params.id, req.params.name);
    if (!stored) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    // Looked up by map key only — the client-supplied name never touches the
    // filesystem, so there is no path-traversal surface here.
    res.set('Content-Type', stored.meta.contentType);
    res.set('Content-Length', String(stored.data.length));
    res.send(stored.data);
  });

  return router;
}
