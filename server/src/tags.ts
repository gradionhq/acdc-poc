import { Router, type Request, type Response } from 'express';
import { NoteStore, TAG_COLORS, type TagColor } from './store.js';

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

const TAG_COLOR_ERROR = `color must be one of: ${TAG_COLORS.join(', ')}`;

/**
 * Validate a tag color from client input against the fixed palette.
 * Returns the parsed TagColor on success, or null when the value is invalid.
 */
function parseTagColor(value: unknown): TagColor | null {
  if (typeof value !== 'string') return null;
  if ((TAG_COLORS as readonly string[]).includes(value)) return value as TagColor;
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

  /** PUT /api/tags/:name — set a tag's color (validated against the palette). */
  router.put('/:name', (req: Request, res: Response) => {
    const name = req.params.name;
    const nameErr = validateTagName(name, 'tag');
    if (nameErr) {
      res.status(400).json({ error: nameErr });
      return;
    }
    const { color } = (req.body ?? {}) as { color?: unknown };
    const parsedColor = parseTagColor(color);
    if (parsedColor === null) {
      res.status(400).json({ error: TAG_COLOR_ERROR });
      return;
    }
    const tag = name.trim();
    store.setTagColor(tag, parsedColor);
    res.json({ tag, color: parsedColor });
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
