import { Router, type Request, type Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { NOTE_COLORS, TAG_COLORS } from './store.js';

// ---------------------------------------------------------------------------
// Shared $ref helpers — avoids repeating the same inline objects many times
// ---------------------------------------------------------------------------

const REF_NOTE = { $ref: '#/components/schemas/Note' };
const REF_ATTACHMENT_META = { $ref: '#/components/schemas/AttachmentMeta' };
const REF_ERROR = { $ref: '#/components/schemas/ErrorResponse' };
const REF_NOT_FOUND = { $ref: '#/components/responses/NotFound' };
const REF_BAD_REQUEST = { $ref: '#/components/responses/BadRequest' };

const JSON_CONTENT = (schema: object) => ({ 'application/json': { schema } });

const NOTE_ID_PARAM = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description: 'Note ID.',
};

const ATTACHMENT_NAME_PARAM = {
  name: 'name',
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description: 'Attachment filename.',
};

/** OpenAPI 3.1 document describing every route in the API. */
const spec = {
  openapi: '3.1.0',
  info: {
    title: 'ACDC Notes API',
    version: '0.1.0',
    description: 'In-memory notes API with attachment, tag, and trash support.',
  },
  servers: [{ url: '/api', description: 'Current host' }],
  tags: [
    { name: 'system', description: 'Health and metadata endpoints.' },
    { name: 'notes', description: 'Create, read, update and organise notes.' },
    { name: 'attachments', description: 'Upload and download note attachments.' },
    { name: 'tags', description: 'Manage tags across notes.' },
  ],
  components: {
    schemas: {
      NoteColor: {
        type: 'string',
        enum: [...NOTE_COLORS],
        description: 'Named color label decorating the note card.',
        example: 'none',
      },
      TagColor: {
        type: 'string',
        enum: [...TAG_COLORS],
        description: 'Named color label decorating a tag chip.',
        example: 'blue',
      },
      Note: {
        type: 'object',
        required: [
          'id',
          'title',
          'body',
          'tags',
          'createdAt',
          'pinned',
          'archived',
          'color',
          'deletedAt',
        ],
        properties: {
          id: { type: 'string', example: '1' },
          title: { type: 'string', example: 'My first note' },
          body: { type: 'string', example: 'Hello, world!' },
          tags: { type: 'array', items: { type: 'string' }, example: ['work', 'idea'] },
          createdAt: {
            type: 'number',
            description: 'Monotonic insertion counter (not a wall-clock timestamp).',
            example: 1,
          },
          pinned: { type: 'boolean', example: false },
          archived: { type: 'boolean', example: false },
          color: { $ref: '#/components/schemas/NoteColor' },
          deletedAt: {
            type: ['number', 'null'],
            description:
              'Wall-clock timestamp (ms) at which the note was trashed, or null when active.',
            example: null,
          },
        },
      },
      AttachmentMeta: {
        type: 'object',
        required: ['filename', 'contentType', 'size'],
        properties: {
          filename: { type: 'string', example: 'photo.png' },
          contentType: { type: 'string', example: 'image/png' },
          size: { type: 'integer', description: 'Byte length.', example: 4096 },
        },
      },
      TagSummary: {
        type: 'object',
        required: ['tag', 'count', 'color'],
        properties: {
          tag: { type: 'string', example: 'work' },
          count: {
            type: 'integer',
            description: 'Number of active (non-trashed) notes carrying this tag.',
            example: 3,
          },
          color: {
            oneOf: [{ $ref: '#/components/schemas/TagColor' }, { type: 'null' }],
            description: 'Assigned tag color, or null when none is set.',
          },
        },
      },
      HealthResponse: {
        type: 'object',
        required: ['status', 'uptime'],
        properties: {
          status: { type: 'string', enum: ['ok'], example: 'ok' },
          uptime: { type: 'number', description: 'Process uptime in seconds.', example: 42.3 },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string', example: 'not found' },
        },
      },
      AffectedResponse: {
        type: 'object',
        required: ['affected'],
        properties: {
          affected: {
            type: 'integer',
            description: 'Number of notes modified by the operation.',
            example: 2,
          },
        },
      },
      CreateNoteRequest: {
        type: 'object',
        required: ['title', 'body'],
        properties: {
          title: { type: 'string', example: 'My note' },
          body: { type: 'string', example: 'Note body text.' },
          tags: { type: 'array', items: { type: 'string' }, example: ['alpha', 'beta'] },
          color: { $ref: '#/components/schemas/NoteColor' },
        },
      },
      UpdateNoteRequest: {
        type: 'object',
        properties: {
          title: { type: 'string', example: 'Updated title' },
          body: { type: 'string', example: 'Updated body.' },
          tags: { type: 'array', items: { type: 'string' }, example: ['new-tag'] },
          color: { $ref: '#/components/schemas/NoteColor' },
        },
        description: 'At least one of title, body, tags, or color must be provided.',
      },
      RenameTagRequest: {
        type: 'object',
        required: ['from', 'to'],
        properties: {
          from: { type: 'string', example: 'work' },
          to: { type: 'string', example: 'office' },
        },
      },
      MergeTagRequest: {
        type: 'object',
        required: ['from', 'to'],
        properties: {
          from: { type: 'string', example: 'todo' },
          to: { type: 'string', example: 'tasks' },
        },
      },
      SetTagColorRequest: {
        type: 'object',
        required: ['color'],
        properties: {
          color: { $ref: '#/components/schemas/TagColor' },
        },
      },
    },
    responses: {
      NotFound: {
        description: 'Resource not found.',
        content: JSON_CONTENT(REF_ERROR),
      },
      BadRequest: {
        description: 'Invalid request payload.',
        content: JSON_CONTENT(REF_ERROR),
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health / liveness check',
        operationId: 'getHealth',
        tags: ['system'],
        security: [],
        responses: {
          '200': {
            description: 'Server is healthy.',
            content: JSON_CONTENT({ $ref: '#/components/schemas/HealthResponse' }),
          },
        },
      },
    },
    '/openapi.json': {
      get: {
        summary: 'OpenAPI specification',
        operationId: 'getOpenApiSpec',
        tags: ['system'],
        security: [],
        responses: {
          '200': {
            description: 'OpenAPI 3.x document.',
            content: JSON_CONTENT({ type: 'object' }),
          },
        },
      },
    },
    '/notes': {
      get: {
        summary: 'List notes',
        operationId: 'listNotes',
        tags: ['notes'],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', minimum: 1, default: 1 },
            description: '1-based page number.',
          },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', minimum: 1, default: 10 },
            description: 'Number of items per page.',
          },
          {
            name: 'q',
            in: 'query',
            schema: { type: 'string' },
            description: 'Full-text search term (case-insensitive, matches title or body).',
          },
          {
            name: 'tag',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter notes that include this tag (case-insensitive exact match).',
          },
          {
            name: 'tags',
            in: 'query',
            schema: { type: 'string' },
            description: 'Comma-separated list of tags for multi-tag filtering.',
          },
          {
            name: 'tagMode',
            in: 'query',
            schema: { type: 'string', enum: ['and', 'or'], default: 'or' },
            description: 'Whether a note must match all (and) or any (or) of the tags filter.',
          },
          {
            name: 'sort',
            in: 'query',
            schema: { type: 'string', enum: ['newest', 'oldest', 'title'], default: 'newest' },
            description: 'Secondary sort order (pinned notes always sort first).',
          },
          {
            name: 'archived',
            in: 'query',
            schema: { type: 'boolean', default: false },
            description: 'When true, list archived notes instead of active ones.',
          },
        ],
        responses: {
          '200': {
            description: 'Paginated list of notes. Pinned notes sort before unpinned.',
            headers: {
              'X-Total-Count': {
                schema: { type: 'integer' },
                description: 'Total number of notes matching the current filter.',
              },
              'X-Total-Pages': {
                schema: { type: 'integer', minimum: 1 },
                description: 'Total number of pages for the current filter and pageSize.',
              },
              'X-Has-Next': {
                schema: { type: 'boolean' },
                description: 'Whether a page after the current one exists.',
              },
            },
            content: JSON_CONTENT({ type: 'array', items: REF_NOTE }),
          },
          '400': REF_BAD_REQUEST,
        },
      },
      post: {
        summary: 'Create a note',
        operationId: 'createNote',
        tags: ['notes'],
        requestBody: {
          required: true,
          content: JSON_CONTENT({ $ref: '#/components/schemas/CreateNoteRequest' }),
        },
        responses: {
          '201': {
            description: 'Note created.',
            content: JSON_CONTENT(REF_NOTE),
          },
          '400': REF_BAD_REQUEST,
        },
      },
    },
    '/notes/trash': {
      get: {
        summary: 'List trashed notes',
        operationId: 'listTrashedNotes',
        tags: ['notes'],
        responses: {
          '200': {
            description: 'Trashed notes, most-recently trashed first.',
            content: JSON_CONTENT({ type: 'array', items: REF_NOTE }),
          },
        },
      },
    },
    '/notes/{id}': {
      parameters: [NOTE_ID_PARAM],
      get: {
        summary: 'Get a single note',
        operationId: 'getNote',
        tags: ['notes'],
        responses: {
          '200': {
            description: 'Note found.',
            content: JSON_CONTENT(REF_NOTE),
          },
          '404': REF_NOT_FOUND,
        },
      },
      put: {
        summary: 'Update a note (partial update)',
        operationId: 'updateNote',
        tags: ['notes'],
        requestBody: {
          required: true,
          content: JSON_CONTENT({ $ref: '#/components/schemas/UpdateNoteRequest' }),
        },
        responses: {
          '200': {
            description: 'Note updated.',
            content: JSON_CONTENT(REF_NOTE),
          },
          '400': REF_BAD_REQUEST,
          '404': REF_NOT_FOUND,
        },
      },
      delete: {
        summary: 'Soft-delete a note (move to trash)',
        operationId: 'deleteNote',
        tags: ['notes'],
        responses: {
          '204': { description: 'Note moved to trash.' },
          '404': REF_NOT_FOUND,
        },
      },
    },
    '/notes/{id}/restore': {
      parameters: [NOTE_ID_PARAM],
      patch: {
        summary: 'Restore a trashed note',
        operationId: 'restoreNote',
        tags: ['notes'],
        responses: {
          '200': {
            description: 'Note restored to the active list.',
            content: JSON_CONTENT(REF_NOTE),
          },
          '404': REF_NOT_FOUND,
        },
      },
    },
    '/notes/{id}/permanent': {
      parameters: [NOTE_ID_PARAM],
      delete: {
        summary: 'Permanently delete a note (irreversible)',
        operationId: 'permanentDeleteNote',
        tags: ['notes'],
        responses: {
          '204': { description: 'Note permanently deleted.' },
          '404': REF_NOT_FOUND,
        },
      },
    },
    '/notes/{id}/duplicate': {
      parameters: [NOTE_ID_PARAM],
      post: {
        summary: 'Duplicate a note',
        operationId: 'duplicateNote',
        tags: ['notes'],
        responses: {
          '201': {
            description: 'A new note copied from the source (attachments are not copied).',
            content: JSON_CONTENT(REF_NOTE),
          },
          '404': REF_NOT_FOUND,
        },
      },
    },
    '/notes/{id}/pin': {
      parameters: [NOTE_ID_PARAM],
      patch: {
        summary: 'Toggle pin on a note',
        operationId: 'togglePinNote',
        tags: ['notes'],
        responses: {
          '200': {
            description: 'Updated note with toggled pinned field.',
            content: JSON_CONTENT(REF_NOTE),
          },
          '404': REF_NOT_FOUND,
        },
      },
    },
    '/notes/{id}/archive': {
      parameters: [NOTE_ID_PARAM],
      patch: {
        summary: 'Toggle archive on a note',
        operationId: 'toggleArchiveNote',
        tags: ['notes'],
        responses: {
          '200': {
            description: 'Updated note with toggled archived field.',
            content: JSON_CONTENT(REF_NOTE),
          },
          '404': REF_NOT_FOUND,
        },
      },
    },
    '/notes/{id}/attachments': {
      parameters: [NOTE_ID_PARAM],
      get: {
        summary: 'List attachments for a note',
        operationId: 'listAttachments',
        tags: ['attachments'],
        responses: {
          '200': {
            description: 'List of attachment metadata.',
            content: JSON_CONTENT({ type: 'array', items: REF_ATTACHMENT_META }),
          },
          '404': REF_NOT_FOUND,
        },
      },
      post: {
        summary: 'Upload one or more attachments to a note',
        operationId: 'uploadAttachment',
        tags: ['attachments'],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description:
                      'Single file (legacy field). Max 5 MB. ' +
                      'Allowed types: image/png, image/jpeg, image/gif, image/webp, ' +
                      'application/pdf, text/plain, text/csv, application/json.',
                  },
                  files: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                    description:
                      'Up to 10 files (25 MB total per request). Same allowed types as `file`.',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description:
              'Attachment(s) uploaded. Returns a single object for the legacy `file` ' +
              'field, or an array when the `files` field is used.',
            content: JSON_CONTENT({
              oneOf: [REF_ATTACHMENT_META, { type: 'array', items: REF_ATTACHMENT_META }],
            }),
          },
          '400': REF_BAD_REQUEST,
          '404': REF_NOT_FOUND,
          '413': {
            description:
              'Attachment limit (20 per note) reached, a file exceeds the 5 MB size ' +
              'limit, or the request exceeds the 25 MB total limit.',
            content: JSON_CONTENT(REF_ERROR),
          },
        },
      },
    },
    '/notes/{id}/attachments/{name}': {
      parameters: [NOTE_ID_PARAM, ATTACHMENT_NAME_PARAM],
      get: {
        summary: 'Download an attachment',
        operationId: 'downloadAttachment',
        tags: ['attachments'],
        responses: {
          '200': {
            description: 'Raw file bytes with the original content type.',
            content: { '*/*': { schema: { type: 'string', format: 'binary' } } },
          },
          '404': REF_NOT_FOUND,
        },
      },
      delete: {
        summary: 'Delete an attachment',
        operationId: 'deleteAttachment',
        tags: ['attachments'],
        responses: {
          '204': { description: 'Attachment deleted.' },
          '404': REF_NOT_FOUND,
        },
      },
    },
    '/tags': {
      get: {
        summary: 'List all tags in use',
        operationId: 'listTags',
        tags: ['tags'],
        responses: {
          '200': {
            description: 'Tags with per-tag note counts and assigned colors.',
            content: JSON_CONTENT({
              type: 'array',
              items: { $ref: '#/components/schemas/TagSummary' },
            }),
          },
        },
      },
    },
    '/tags/rename': {
      post: {
        summary: 'Rename a tag globally',
        operationId: 'renameTag',
        tags: ['tags'],
        requestBody: {
          required: true,
          content: JSON_CONTENT({ $ref: '#/components/schemas/RenameTagRequest' }),
        },
        responses: {
          '200': {
            description: 'Number of notes affected by the rename.',
            content: JSON_CONTENT({ $ref: '#/components/schemas/AffectedResponse' }),
          },
          '400': REF_BAD_REQUEST,
          '409': {
            description: 'The target tag name already exists as a distinct tag.',
            content: JSON_CONTENT(REF_ERROR),
          },
        },
      },
    },
    '/tags/merge': {
      post: {
        summary: 'Merge one tag into another',
        operationId: 'mergeTag',
        tags: ['tags'],
        requestBody: {
          required: true,
          content: JSON_CONTENT({ $ref: '#/components/schemas/MergeTagRequest' }),
        },
        responses: {
          '200': {
            description: 'Number of notes affected by the merge.',
            content: JSON_CONTENT({ $ref: '#/components/schemas/AffectedResponse' }),
          },
          '400': REF_BAD_REQUEST,
        },
      },
    },
    '/tags/{name}': {
      parameters: [
        {
          name: 'name',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Tag name.',
        },
      ],
      put: {
        summary: "Set a tag's color",
        operationId: 'setTagColor',
        tags: ['tags'],
        requestBody: {
          required: true,
          content: JSON_CONTENT({ $ref: '#/components/schemas/SetTagColorRequest' }),
        },
        responses: {
          '200': {
            description: 'The tag and its newly assigned color.',
            content: JSON_CONTENT({
              type: 'object',
              required: ['tag', 'color'],
              properties: {
                tag: { type: 'string', example: 'work' },
                color: { $ref: '#/components/schemas/TagColor' },
              },
            }),
          },
          '400': REF_BAD_REQUEST,
        },
      },
      delete: {
        summary: 'Delete a tag from every note',
        operationId: 'deleteTag',
        tags: ['tags'],
        responses: {
          '200': {
            description: 'Number of notes the tag was removed from.',
            content: JSON_CONTENT({ $ref: '#/components/schemas/AffectedResponse' }),
          },
          '400': REF_BAD_REQUEST,
        },
      },
    },
  },
};

/** The frozen OpenAPI document. Exported for tests and the docs UI. */
export const openApiSpec = spec;

/**
 * Minimal structural validation of the OpenAPI document. Throws a descriptive
 * error when a required top-level field is missing or every `$ref` does not
 * resolve to a defined component. Returns the spec on success so callers can
 * assert on it.
 *
 * This is intentionally dependency-free: it checks the invariants that matter
 * for a served spec (version, info, at least one path, and that every internal
 * `$ref` points at something that exists) without pulling in a full validator.
 */
export function validateOpenApiSpec(doc: typeof spec = spec): typeof spec {
  if (typeof doc.openapi !== 'string' || !/^3\./.test(doc.openapi)) {
    throw new Error('openapi version must be a 3.x string');
  }
  if (!doc.info || typeof doc.info.title !== 'string' || typeof doc.info.version !== 'string') {
    throw new Error('info.title and info.version are required');
  }
  if (!doc.paths || Object.keys(doc.paths).length === 0) {
    throw new Error('spec must document at least one path');
  }

  // Walk the whole document collecting $ref strings and verify each resolves.
  const refs: string[] = [];
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
        if (key === '$ref' && typeof v === 'string') {
          refs.push(v);
        } else {
          collect(v);
        }
      }
    }
  };
  collect(doc);

  const root = doc as unknown as Record<string, unknown>;
  for (const ref of refs) {
    if (!ref.startsWith('#/')) {
      throw new Error(`only local $ref is supported: ${ref}`);
    }
    const segments = ref.slice(2).split('/');
    let node: unknown = root;
    for (const segment of segments) {
      if (!node || typeof node !== 'object' || !(segment in (node as Record<string, unknown>))) {
        throw new Error(`unresolved $ref: ${ref}`);
      }
      node = (node as Record<string, unknown>)[segment];
    }
  }

  return doc;
}

/**
 * Router exposing the raw spec at `GET /` (mounted at `/api/openapi.json`).
 */
export function createOpenApiRouter(): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    res.json(spec);
  });

  return router;
}

/**
 * Whether the interactive Swagger UI should be served. Enabled outside
 * production, or explicitly opted in via `ENABLE_API_DOCS=1`. Kept off in
 * production by default so the docs surface is not exposed unintentionally.
 */
export function docsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.ENABLE_API_DOCS === '1') return true;
  if (env.ENABLE_API_DOCS === '0') return false;
  return env.NODE_ENV !== 'production';
}

/**
 * Router serving the interactive Swagger UI (mounted at `/api/docs`). The UI
 * loads the same `spec` object so it always matches the served `openapi.json`.
 */
export function createDocsRouter(): Router {
  const router = Router();
  router.use(swaggerUi.serve);
  router.get(
    '/',
    swaggerUi.setup(spec, {
      customSiteTitle: 'ACDC Notes API — Docs',
    }),
  );
  return router;
}
