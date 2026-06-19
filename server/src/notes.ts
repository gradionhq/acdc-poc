import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { NoteStore, type TagMode } from './store.js';
import {
  createNoteSchema,
  listNotesQuerySchema,
  parse,
  reorderPinsSchema,
  updateNoteSchema,
} from './schemas.js';

/** Bulk actions accepted by POST /api/notes/batch. */
const BATCH_ACTIONS = [
  'archive',
  'unarchive',
  'trash',
  'restore',
  'add-tag',
  'remove-tag',
] as const;
type BatchAction = (typeof BATCH_ACTIONS)[number];

/**
 * Upper bound on the number of ids accepted in a single batch request. Caps the
 * work performed per request so a single call cannot iterate an unbounded list.
 */
const MAX_BATCH_IDS = 1000;

function isBatchAction(value: unknown): value is BatchAction {
  return typeof value === 'string' && (BATCH_ACTIONS as readonly string[]).includes(value);
}

/**
 * Validate the `ids` field of a batch request. Returns a de-duplicated array of
 * non-empty string ids, or null when the input is not a non-empty array of
 * non-empty strings.
 */
function parseBatchIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') return null;
    seen.add(item);
  }
  return [...seen];
}

/**
 * Resolve a batch action to a function that applies it to a single note id,
 * returning true on success and false when the note could not be acted on
 * (e.g. it does not exist). Tag actions require `tag` to be provided.
 */
function batchActionFor(
  store: NoteStore,
  action: BatchAction,
  tag: string | undefined,
): (id: string) => boolean {
  switch (action) {
    case 'archive':
      return (id) => store.setArchived(id, true) !== undefined;
    case 'unarchive':
      return (id) => store.setArchived(id, false) !== undefined;
    case 'trash':
      return (id) => store.trash(id) !== undefined;
    case 'restore':
      return (id) => store.restore(id) !== undefined;
    case 'add-tag':
      return (id) => store.addTagToNote(id, tag as string) !== undefined;
    case 'remove-tag':
      return (id) => store.removeTagFromNote(id, tag as string) !== undefined;
  }
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

/** 1 MB upper bound for an imported Markdown file. */
const MAX_MARKDOWN_BYTES = 1 * 1024 * 1024;

/**
 * Content types accepted for Markdown import. Browsers and clients are
 * inconsistent about the MIME type of `.md` files, so we accept the common
 * variants plus `text/plain` and the generic octet-stream fallback. The
 * `.md`/`.markdown` extension is also enforced (see {@link markdownFileFilter}).
 */
const ALLOWED_MARKDOWN_CONTENT_TYPES = new Set([
  'text/markdown',
  'text/x-markdown',
  'text/plain',
  'application/octet-stream',
]);

/** True when the filename ends in a recognised Markdown extension. */
function hasMarkdownExtension(filename: string): boolean {
  return /\.(md|markdown)$/i.test(filename);
}

function markdownFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  if (!ALLOWED_MARKDOWN_CONTENT_TYPES.has(file.mimetype)) {
    cb(new Error(`unsupported content type: ${file.mimetype}`));
    return;
  }
  if (!hasMarkdownExtension(file.originalname)) {
    cb(new Error('file must have a .md or .markdown extension'));
    return;
  }
  cb(null, true);
}

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MARKDOWN_BYTES, files: 1 },
  fileFilter: markdownFileFilter,
});

/** Strip a leading UTF-8 byte-order mark, if present. */
function stripBom(text: string): string {
  return text.codePointAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Parse a Markdown document into a note title and body.
 *
 * The first ATX heading (`#` … `######`) found before any body content becomes
 * the title, with its leading `#` markers and surrounding whitespace stripped;
 * the remaining lines (after the heading) become the body. When no leading
 * heading is present the whole document is the body and the title falls back to
 * `'Untitled'`. Returns null when the document has no usable content at all.
 */
function parseMarkdown(raw: string): { title: string; body: string } | null {
  const text = stripBom(raw).replace(/\r\n?/g, '\n');
  const lines = text.split('\n');

  let index = 0;
  // Skip leading blank lines so a heading after blank lines is still detected.
  while (index < lines.length && lines[index].trim() === '') index += 1;

  if (index >= lines.length) return null;

  // Detect an ATX heading (1-6 leading '#' then a space/tab) with pure string ops —
  // no regex, so Sonar raises no ReDoS hotspot to review.
  const line = lines[index];
  let hashes = 0;
  while (hashes < line.length && line[hashes] === '#') hashes += 1;
  const sep = line[hashes];
  if (hashes >= 1 && hashes <= 6 && (sep === ' ' || sep === '\t')) {
    let title = line.slice(hashes).trim();
    // CommonMark: a trailing run of '#' preceded by whitespace is a closing sequence — strip it.
    let h = title.length;
    while (h > 0 && title[h - 1] === '#') h -= 1;
    if (h < title.length && h > 0 && (title[h - 1] === ' ' || title[h - 1] === '\t')) {
      title = title.slice(0, h).trimEnd();
    }
    const body = lines
      .slice(index + 1)
      .join('\n')
      .trim();
    return { title: title === '' ? 'Untitled' : title, body };
  }

  return { title: 'Untitled', body: text.trim() };
}

export function createNotesRouter(store: NoteStore): Router {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    const parsed = parse(listNotesQuerySchema, req.query);
    if (!parsed.ok) {
      res.status(400).json(parsed.failure);
      return;
    }
    const {
      page,
      pageSize,
      q,
      tag,
      sort = 'newest',
      archived: archivedParam,
      tags: tagsParam,
    } = parsed.data;
    const archived = archivedParam === 'true';
    // Multi-tag filter: ?tags=a,b (comma-separated string) — missing or empty → no filter.
    const tags =
      typeof tagsParam === 'string' && tagsParam.trim() !== ''
        ? tagsParam
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t !== '')
        : [];
    const tagMode: TagMode = parsed.data.tagMode;
    const result = store.list(page, pageSize, q, tag, sort, archived, tags, tagMode);
    // Richer pagination metadata so the client consumes it instead of inferring.
    // X-Total-Count is retained for backward compatibility.
    res.set('X-Total-Count', String(result.total));
    res.set('X-Total-Pages', String(result.totalPages));
    res.set('X-Has-Next', String(result.hasNext));
    res.json(result.items);
  });

  router.post('/', (req: Request, res: Response) => {
    const parsed = parse(createNoteSchema, req.body ?? {});
    if (!parsed.ok) {
      res.status(400).json(parsed.failure);
      return;
    }
    const { title, body, tags, color } = parsed.data;
    res.status(201).json(
      store.create({
        title,
        body,
        tags: tags ?? [],
        ...(color !== undefined ? { color } : {}),
      }),
    );
  });

  // --- Batch endpoint (must be registered before /:id to avoid path conflicts) ---

  /**
   * POST /api/notes/batch — apply one action to many notes at once.
   *
   * Body: { ids: string[], action: BatchAction, tag?: string }
   *   - action ∈ archive | unarchive | trash | restore | add-tag | remove-tag
   *   - tag is required (non-empty string) for add-tag / remove-tag only.
   *
   * Each id is processed independently; the response reports which ids
   * succeeded and which failed (with a reason), so a missing id never aborts
   * the whole batch. Always responds 200 once the request validates.
   */
  router.post('/batch', (req: Request, res: Response) => {
    const payload = req.body;
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      res.status(400).json({ error: 'payload must be an object' });
      return;
    }
    const { ids, action, tag } = payload as {
      ids?: unknown;
      action?: unknown;
      tag?: unknown;
    };

    const parsedIds = parseBatchIds(ids);
    if (parsedIds === null) {
      res.status(400).json({ error: 'ids must be a non-empty array of strings' });
      return;
    }
    if (parsedIds.length > MAX_BATCH_IDS) {
      res.status(400).json({ error: `ids must contain at most ${MAX_BATCH_IDS} items` });
      return;
    }
    if (!isBatchAction(action)) {
      res.status(400).json({ error: `action must be one of: ${BATCH_ACTIONS.join(', ')}` });
      return;
    }

    // Tag actions require a valid, trimmed tag; non-tag actions must not carry one.
    let normalizedTag: string | undefined;
    if (action === 'add-tag' || action === 'remove-tag') {
      if (typeof tag !== 'string' || tag.trim() === '') {
        res.status(400).json({ error: 'tag must be a non-empty string for tag actions' });
        return;
      }
      normalizedTag = tag.trim();
    } else if (tag !== undefined) {
      res.status(400).json({ error: 'tag is only valid for add-tag and remove-tag actions' });
      return;
    }

    const apply = batchActionFor(store, action, normalizedTag);
    const succeeded: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];
    for (const id of parsedIds) {
      if (apply(id)) {
        succeeded.push(id);
      } else {
        failed.push({ id, reason: 'not found' });
      }
    }
    res.json({ action, succeeded, failed });
  });

  /**
   * POST /api/notes/import — create a note from an uploaded Markdown file.
   *
   * Accepts a single `.md`/`.markdown` file under the `file` field. The upload
   * is size-capped ({@link MAX_MARKDOWN_BYTES}) and content-type/extension
   * validated ({@link markdownFileFilter}); oversized or invalid files are
   * rejected by multer (413 / 400). The first leading heading becomes the note
   * title and the remaining body becomes the note content.
   */
  router.post('/import', importUpload.single('file'), (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'file field is required' });
      return;
    }

    const parsed = parseMarkdown(file.buffer.toString('utf8'));
    if (!parsed) {
      res.status(400).json({ error: 'file is empty' });
      return;
    }

    res.status(201).json(store.create({ title: parsed.title, body: parsed.body, tags: [] }));
  });

  /**
   * PATCH /api/notes/pin-order — persist a new top-to-bottom order for the
   * pinned notes.
   *
   * Body: { ids: string[] } — must list exactly the set of currently-pinned,
   * active notes (no more, no fewer), in the desired order. Requiring the
   * complete set keeps ordering unambiguous and guards against acting on a
   * stale client view (e.g. a note pinned/unpinned in another tab). Responds:
   *   - 200 { ids } on success (echoes the applied order),
   *   - 400 when the body is malformed,
   *   - 409 when the ids do not match the current pinned set.
   *
   * Registered before /:id so "pin-order" is never mistaken for a note id.
   */
  router.patch('/pin-order', (req: Request, res: Response) => {
    const payload: unknown = req.body;
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      res.status(400).json({ error: 'payload must be an object' });
      return;
    }
    const parsed = parse(reorderPinsSchema, payload);
    if (!parsed.ok) {
      res.status(400).json(parsed.failure);
      return;
    }
    const { ids } = parsed.data;
    // The request must reference exactly the current pinned set — same members,
    // no duplicates (already enforced), nothing missing or extra.
    const current = store.pinnedIds();
    const sameSet =
      ids.length === current.length && new Set(ids).size === new Set([...ids, ...current]).size;
    if (!sameSet || !store.reorderPinned(ids)) {
      res.status(409).json({ error: 'ids must match the current set of pinned notes' });
      return;
    }
    res.json({ ids });
  });

  // --- Trash endpoints (must be registered before /:id to avoid path conflicts) ---

  /** List all trashed notes, sorted by most-recently trashed first. */
  router.get('/trash', (_req: Request, res: Response) => {
    res.json(store.listTrashed());
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
    const payload: unknown = req.body;
    // Shape guard: zod's object schema would also reject these, but the legacy
    // contract returns this specific message for non-object bodies.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      res.status(400).json({ error: 'payload must be an object' });
      return;
    }
    const parsed = parse(updateNoteSchema, payload);
    if (!parsed.ok) {
      res.status(400).json(parsed.failure);
      return;
    }
    const { title, body, tags, color } = parsed.data;
    const note = store.update(req.params.id, {
      title,
      body,
      ...(tags !== undefined ? { tags } : {}),
      ...(color !== undefined ? { color } : {}),
    });
    if (!note) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(note);
  });

  router.delete('/:id', (req: Request, res: Response) => {
    // Soft-delete: move the note to trash instead of removing it permanently.
    const note = store.trash(req.params.id);
    if (!note) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.status(204).end();
  });

  /** Restore a trashed note back to the active list. */
  router.patch('/:id/restore', (req: Request, res: Response) => {
    const note = store.restore(req.params.id);
    if (!note) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(note);
  });

  /** Permanently delete a note from the store (irreversible). */
  router.delete('/:id/permanent', (req: Request, res: Response) => {
    if (!store.permanentDelete(req.params.id)) {
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
