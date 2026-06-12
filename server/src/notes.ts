import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { NOTE_COLORS, NoteStore, type NoteColor, type SortOrder, type TagMode } from './store.js';

const VALID_SORT_VALUES: readonly SortOrder[] = ['newest', 'oldest', 'title'];

function parseSortOrder(value: unknown): SortOrder | null {
  if (value === undefined) return 'newest';
  if (typeof value !== 'string') return null;
  if ((VALID_SORT_VALUES as readonly string[]).includes(value)) return value as SortOrder;
  return null;
}

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

/** Maximum number of files accepted in a single multi-file upload request. */
const MAX_FILES_PER_UPLOAD = 10;

/**
 * Maximum total bytes buffered across all files in a single upload request.
 * Caps memory usage per request regardless of how many files are sent.
 * Set to 25 MB (5 files × 5 MB) — a reasonable middle-ground that still
 * allows meaningful multi-file batches without risking heap pressure under
 * concurrency.
 */
const MAX_REQUEST_BYTES = 25 * 1024 * 1024;

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
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES_PER_UPLOAD },
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

const COLOR_ERROR = `color must be one of: ${NOTE_COLORS.join(', ')}`;

/**
 * Validate a color field from client input.
 * Returns the parsed NoteColor on success, or null when the value is invalid.
 * Returns undefined when the field is absent (caller treats as "use default").
 */
function parseColor(value: unknown): NoteColor | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return null;
  if ((NOTE_COLORS as readonly string[]).includes(value)) return value as NoteColor;
  return null;
}

export function createNotesRouter(store: NoteStore): Router {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.pageSize, 10);
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const tag = typeof req.query.tag === 'string' ? req.query.tag : undefined;
    const sort = parseSortOrder(req.query.sort);
    if (sort === null) {
      res.status(400).json({ error: 'sort must be one of: newest, oldest, title' });
      return;
    }
    const archivedParam = req.query.archived;
    if (archivedParam !== undefined && archivedParam !== 'true' && archivedParam !== 'false') {
      res.status(400).json({ error: 'archived must be "true" or "false"' });
      return;
    }
    const archived = archivedParam === 'true';
    // Multi-tag filter: ?tags=a,b (comma-separated string) — missing or empty → no filter.
    const tagsParam = req.query.tags;
    const tags =
      typeof tagsParam === 'string' && tagsParam.trim() !== ''
        ? tagsParam
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t !== '')
        : [];
    // tagMode: 'and' | 'or' — missing or invalid defaults to 'or'.
    const tagModeParam = req.query.tagMode;
    const tagMode: TagMode = tagModeParam === 'and' || tagModeParam === 'or' ? tagModeParam : 'or';
    const result = store.list(page, pageSize, q, tag, sort, archived, tags, tagMode);
    res.set('X-Total-Count', String(result.total));
    res.json(result.items);
  });

  router.post('/', (req: Request, res: Response) => {
    const { title, body, tags, color } = (req.body ?? {}) as {
      title?: unknown;
      body?: unknown;
      tags?: unknown;
      color?: unknown;
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
    const parsedColor = parseColor(color);
    if (parsedColor === null) {
      res.status(400).json({ error: COLOR_ERROR });
      return;
    }
    res.status(201).json(
      store.create({
        title,
        body,
        tags: parsedTags,
        ...(parsedColor !== undefined ? { color: parsedColor } : {}),
      }),
    );
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
    const { title, body, tags, color } = payload as {
      title?: unknown;
      body?: unknown;
      tags?: unknown;
      color?: unknown;
    };
    if (title === undefined && body === undefined && tags === undefined && color === undefined) {
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
    const parsedColor = parseColor(color);
    if (parsedColor === null) {
      res.status(400).json({ error: COLOR_ERROR });
      return;
    }
    if (tags !== undefined) {
      const parsedTags = parseTags(tags);
      if (parsedTags === null) {
        res.status(400).json({ error: 'tags must be an array of non-empty strings' });
        return;
      }
      const note = store.update(req.params.id, {
        title,
        body,
        tags: parsedTags,
        ...(parsedColor !== undefined ? { color: parsedColor } : {}),
      });
      if (!note) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      res.json(note);
      return;
    }
    const note = store.update(req.params.id, {
      title,
      body,
      ...(parsedColor !== undefined ? { color: parsedColor } : {}),
    });
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

  router.patch('/:id/archive', (req: Request, res: Response) => {
    const note = store.toggleArchive(req.params.id);
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
    (req: Request, res: Response, next: NextFunction) => {
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
    // Accept either a single 'file' field (backward-compat) or up to
    // MAX_FILES_PER_UPLOAD files under the 'files' field.
    upload.fields([
      { name: 'file', maxCount: 1 },
      { name: 'files', maxCount: MAX_FILES_PER_UPLOAD },
    ]),
    (req: Request, res: Response) => {
      // Normalise: collect uploaded files from whichever field was used.
      const fields = req.files as Record<string, Express.Multer.File[]> | undefined;
      const uploadedFiles: Express.Multer.File[] = [
        ...(fields?.['file'] ?? []),
        ...(fields?.['files'] ?? []),
      ];

      if (uploadedFiles.length === 0) {
        res.status(400).json({ error: 'file field is required' });
        return;
      }

      // Enforce total-bytes cap across the batch to bound per-request memory
      // usage (memoryStorage buffers every byte in the heap).
      const totalBytes = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
      if (totalBytes > MAX_REQUEST_BYTES) {
        res.status(413).json({ error: 'request too large' });
        return;
      }

      // Enforce cap across the entire batch: reject if adding all files would
      // exceed the per-note limit.
      const currentCount = store.attachmentCount(req.params.id);
      if (currentCount + uploadedFiles.length > NoteStore.MAX_ATTACHMENTS_PER_NOTE) {
        res.status(413).json({
          error: `attachment limit of ${NoteStore.MAX_ATTACHMENTS_PER_NOTE} per note reached`,
        });
        return;
      }

      // Re-check note existence immediately before writing so the batch is
      // either fully committed or fully rejected (no partial writes).
      if (!store.get(req.params.id)) {
        res.status(404).json({ error: 'not found' });
        return;
      }

      const metas = uploadedFiles.map((f) =>
        store.addAttachment(req.params.id, {
          filename: f.originalname,
          contentType: f.mimetype,
          data: f.buffer,
        }),
      );

      // Defensive: addAttachment returns undefined only if the note was deleted
      // between the guard above and the writes (benign PoC race).
      if (metas.some((m) => m === undefined)) {
        res.status(404).json({ error: 'not found' });
        return;
      }

      // Single-file backward-compat: return a plain object (not an array)
      // when the caller used the legacy 'file' field.
      if (fields?.['file']?.length === 1 && !fields?.['files']?.length) {
        res.status(201).json(metas[0]);
        return;
      }

      res.status(201).json(metas);
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

  router.delete('/:id/attachments/:name', (req: Request, res: Response) => {
    // deleteAttachment sanitises the filename internally — client cannot control
    // the storage key. Returns undefined if the note is missing, false if the
    // attachment is missing, true on successful deletion.
    const result = store.deleteAttachment(req.params.id, req.params.name);
    if (result === undefined || result === false) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.status(204).end();
  });

  return router;
}
