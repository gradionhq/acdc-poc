import { Router, type Request, type Response } from 'express';
import type { NoteStore } from './store.js';

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : fallback;
}

function parseTags(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const normalized: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const trimmed = item.trim();
    if (trimmed === '') return null;
    normalized.push(trimmed);
  }
  return [...new Set(normalized)];
}

export function createNotesRouter(store: NoteStore): Router {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.pageSize, 10);
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const tag = typeof req.query.tag === 'string' ? req.query.tag : undefined;
    const result = store.list(page, pageSize, q, tag);
    res.set('X-Total-Count', String(result.total));
    res.json(result.items);
  });

  router.post('/', (req: Request, res: Response) => {
    const { title, body, tags } = (req.body ?? {}) as {
      title?: unknown;
      body?: unknown;
      tags?: unknown;
    };
    if (typeof title !== 'string' || typeof body !== 'string') {
      res.status(400).json({ error: 'title and body must be strings' });
      return;
    }
    const parsedTags = parseTags(tags);
    if (parsedTags === null) {
      res.status(400).json({ error: 'tags must be an array of non-empty strings' });
      return;
    }
    res.status(201).json(store.create({ title, body, tags: parsedTags }));
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
    const payload = req.body;
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      res.status(400).json({ error: 'payload must be an object' });
      return;
    }
    const { title, body, tags } = payload as { title?: unknown; body?: unknown; tags?: unknown };
    if (title === undefined && body === undefined && tags === undefined) {
      res.status(400).json({ error: 'at least one of title, body, or tags is required' });
      return;
    }
    if (title !== undefined && typeof title !== 'string') {
      res.status(400).json({ error: 'title must be a string' });
      return;
    }
    if (body !== undefined && typeof body !== 'string') {
      res.status(400).json({ error: 'body must be a string' });
      return;
    }
    if (tags !== undefined) {
      const parsedTags = parseTags(tags);
      if (parsedTags === null) {
        res.status(400).json({ error: 'tags must be an array of non-empty strings' });
        return;
      }
      const note = store.update(req.params.id, { title, body, tags: parsedTags });
      if (!note) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      res.json(note);
      return;
    }
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
