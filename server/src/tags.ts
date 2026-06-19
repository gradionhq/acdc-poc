import { Router, type Request, type Response } from 'express';
import { NoteStore } from './store.js';
import { parse, renameTagSchema, setTagColorSchema, tagNameParamSchema } from './schemas.js';

export function createTagsRouter(store: NoteStore): Router {
  const router = Router();

  /** GET /api/tags — list all tags in use with per-tag note counts. */
  router.get('/', (_req: Request, res: Response) => {
    res.json(store.listTags());
  });

  /** POST /api/tags/rename — rename a tag globally across all notes. */
  router.post('/rename', (req: Request, res: Response) => {
    const parsed = parse(renameTagSchema, req.body ?? {});
    if (!parsed.ok) {
      res.status(400).json(parsed.failure);
      return;
    }

    const fromTag = parsed.data.from.trim();
    const toTag = parsed.data.to.trim();

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
    const nameResult = parse(tagNameParamSchema, { tag: req.params.name });
    if (!nameResult.ok) {
      res.status(400).json(nameResult.failure);
      return;
    }
    const bodyResult = parse(setTagColorSchema, req.body ?? {});
    if (!bodyResult.ok) {
      res.status(400).json(bodyResult.failure);
      return;
    }
    const tag = nameResult.data.tag.trim();
    store.setTagColor(tag, bodyResult.data.color);
    res.json({ tag, color: bodyResult.data.color });
  });

  /** DELETE /api/tags/:tag — remove a tag from every note that carries it. */
  router.delete('/:tag', (req: Request, res: Response) => {
    const parsed = parse(tagNameParamSchema, { tag: req.params.tag });
    if (!parsed.ok) {
      res.status(400).json(parsed.failure);
      return;
    }
    const affected = store.deleteTag(parsed.data.tag.trim());
    res.json({ affected });
  });

  return router;
}
