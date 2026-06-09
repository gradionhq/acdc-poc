import { Router, type Request, type Response } from 'express';
import type { NoteStore } from './store.js';

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : fallback;
}

export function createNotesRouter(store: NoteStore): Router {
  const router = Router();

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

  return router;
}
