import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { NoteStore } from './store.js';

/**
 * Encode a filename for use in a Content-Disposition header following
 * RFC 6266 / RFC 5987.  Emits both the quoted ASCII fallback (non-ASCII
 * chars replaced with '?') and the UTF-8 percent-encoded filename* form
 * so all compliant clients get the correct name.
 */
function contentDispositionFilename(filename: string): string {
  // ASCII fallback: replace non-printable/non-ASCII with '?'
  const ascii = filename.replace(/[^\x20-\x7e]/g, '?').replace(/["\\]/g, '_');
  // RFC 5987 percent-encoding: encode everything outside unreserved chars
  const encoded = encodeURIComponent(filename).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** 5 MB upper bound for individual file uploads. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Allowed MIME content types for attachment uploads.
 * We check the declared content-type; no magic-byte sniffing needed for the
 * proof-of-work, but we do reject anything not in this list.
 */
const ALLOWED_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter(_req, file, cb) {
    if (ALLOWED_CONTENT_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`unsupported content type: ${file.mimetype}`));
    }
  },
});

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

  router.post('/:id/duplicate', (req: Request, res: Response) => {
    const copy = store.duplicate(req.params.id);
    if (!copy) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.status(201).json(copy);
  });

  router.patch('/:id/pin', (req: Request, res: Response) => {
    const note = store.togglePin(req.params.id);
    if (!note) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(note);
  });

  // --- Attachment endpoints ---

  router.get('/:id/attachments', (req: Request, res: Response) => {
    const metas = store.listAttachments(req.params.id);
    if (!metas) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(metas);
  });

  router.post(
    '/:id/attachments',
    (req: Request, res: Response, next) => {
      // Verify note existence before parsing the multipart body — gives an
      // immediate 404 without consuming upload bytes for a missing note.
      if (!store.get(req.params.id)) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      // Enforce per-note attachment cap before consuming upload bytes.
      if (store.attachmentCount(req.params.id) >= NoteStore.MAX_ATTACHMENTS_PER_NOTE) {
        res.status(413).json({
          error: `attachment limit of ${NoteStore.MAX_ATTACHMENTS_PER_NOTE} per note reached`,
        });
        return;
      }
      next();
    },
    upload.single('file'),
    (req: Request, res: Response) => {
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
        // Note was deleted between the pre-check and store write — treat as 404.
        // The cap check above ran before upload; a race here is benign for a PoC.
        res.status(404).json({ error: 'not found' });
        return;
      }
      res.status(201).json(meta);
    },
  );

  router.get('/:id/attachments/:name', (req: Request, res: Response) => {
    // The key lookup goes through sanitiseFilename internally — client cannot
    // control the storage path.
    const att = store.getAttachment(req.params.id, req.params.name);
    if (!att) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.set('Content-Type', att.contentType);
    res.set('Content-Disposition', contentDispositionFilename(att.filename));
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Length', String(att.size));
    res.send(att.data);
  });

  return router;
}
