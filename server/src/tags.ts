import { Router, type Request, type Response } from 'express';
import { NoteStore } from './store.js';

/** Maximum byte-length for a tag name. */
const MAX_TAG_LENGTH = 100;

function validateTagName(value: unknown, fieldName: string): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return `${fieldName} must be a non-empty string`;
  }
  if (value.trim().length > MAX_TAG_LENGTH) {
    return `${fieldName} must be at most ${MAX_TAG_LENGTH} characters`;
  }
  if (value.includes(',')) {
    return `${fieldName} must not contain commas`;
  }
  return null;
}

export function createTagsRouter(store: NoteStore): Router {
  const router = Router();

  /** GET /api/tags — list all tags in use with per-tag note counts. */
  router.get('/', (_req: Request, res: Response) => {
    res.json(store.listTags());
  });

  /** POST /api/tags/rename — rename a tag globally across all notes. */
  router.post('/rename', (req: Request, res: Response) => {
    const { from, to } = (req.body ?? {}) as { from?: unknown; to?: unknown };

    const fromErr = validateTagName(from, 'from');
    if (fromErr) {
      res.status(400).json({ error: fromErr });
      return;
    }
    const toErr = validateTagName(to, 'to');
    if (toErr) {
      res.status(400).json({ error: toErr });
      return;
    }

    const fromTag = (from as string).trim();
    const toTag = (to as string).trim();

    // Reject if `to` already exists as a distinct tag to avoid silently merging
    // two different tags in an unexpected way.
    const existing = store.listTags().map((t) => t.tag);
    if (existing.includes(toTag) && toTag !== fromTag) {
      res.status(409).json({ error: `tag "${toTag}" already exists` });
      return;
    }

    const affected = store.renameTag(fromTag, toTag);
    res.json({ affected });
  });

  /** DELETE /api/tags/:tag — remove a tag from every note that carries it. */
  router.delete('/:tag', (req: Request, res: Response) => {
    const tag = req.params.tag;
    const err = validateTagName(tag, 'tag');
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
    const affected = store.deleteTag(tag.trim());
    res.json({ affected });
  });

  return router;
}
