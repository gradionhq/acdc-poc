import { z, type ZodType } from 'zod';
import { NOTE_COLORS, TAG_COLORS } from './store.js';

/**
 * Shared zod schemas + a small validation helper used at the route boundary.
 *
 * Every external input (`req.body`, `req.query`, `req.params`) is parsed through
 * one of these schemas before a handler trusts it. On failure the helper
 * produces a 400-shaped payload that preserves the historical `error` string
 * (so existing clients/tests keep working) while additionally exposing a
 * structured, per-field `details` array.
 */

/** Maximum byte-length for a tag name (mirrors the previous ad-hoc check). */
export const MAX_TAG_LENGTH = 100;

const COLOR_ERROR = `color must be one of: ${NOTE_COLORS.join(', ')}`;
const TAG_COLOR_ERROR = `color must be one of: ${TAG_COLORS.join(', ')}`;

/** A single non-empty, trimmed tag string. */
const tagItem = z
  .string({ error: 'tags must be an array of non-empty strings' })
  .transform((s) => s.trim())
  .refine((s) => s !== '', { error: 'tags must be an array of non-empty strings' });

/** An array of tags, deduplicated and trimmed. */
const tagsArray = z
  .array(tagItem, { error: 'tags must be an array of non-empty strings' })
  .transform((arr) => [...new Set(arr)]);

/** Note color — one of the fixed palette. */
const noteColor = z.enum(NOTE_COLORS, { error: COLOR_ERROR });

/** Tag color — one of the fixed palette (no "none"). */
const tagColor = z.enum(TAG_COLORS, { error: TAG_COLOR_ERROR });

/** POST /api/notes body. */
export const createNoteSchema = z.object({
  title: z.string({ error: 'title and body must be strings' }),
  body: z.string({ error: 'title and body must be strings' }),
  tags: tagsArray.optional(),
  color: noteColor.optional(),
});

/** PUT /api/notes/:id body — at least one field, each optional but typed. */
export const updateNoteSchema = z
  .object({
    title: z.string({ error: 'title must be a string' }).optional(),
    body: z.string({ error: 'body must be a string' }).optional(),
    tags: tagsArray.optional(),
    color: noteColor.optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.body !== undefined ||
      v.tags !== undefined ||
      v.color !== undefined,
    { error: 'at least one of title, body, or tags is required' },
  );

/** A single tag-name string for body/param validation. */
const tagName = (field: string): ZodType<string> =>
  z
    .string({ error: `${field} must be a non-empty string` })
    .refine((s) => s.trim() !== '', { error: `${field} must be a non-empty string` })
    .refine((s) => s.trim().length <= MAX_TAG_LENGTH, {
      error: `${field} must be at most ${MAX_TAG_LENGTH} characters`,
    })
    .refine((s) => !s.includes(','), { error: `${field} must not contain commas` });

/** POST /api/tags/rename body. */
export const renameTagSchema = z.object({
  from: tagName('from'),
  to: tagName('to'),
});

/** POST /api/tags/merge body. */
export const mergeTagSchema = z.object({
  from: tagName('from'),
  to: tagName('to'),
});

/** PUT /api/tags/:name body. */
export const setTagColorSchema = z.object({
  color: tagColor,
});

/** Tag-name route param (PUT/DELETE /api/tags/:name). */
export const tagNameParamSchema = z.object({ tag: tagName('tag') });

/**
 * PATCH /api/notes/pin-order body — the desired top-to-bottom order of the
 * pinned notes, given as a non-empty array of unique note-id strings.
 */
export const reorderPinsSchema = z.object({
  ids: z
    .array(
      z
        .string({ error: 'ids must be an array of non-empty strings' })
        .refine((s) => s.trim() !== '', { error: 'ids must be an array of non-empty strings' }),
      { error: 'ids must be an array of non-empty strings' },
    )
    .min(1, { error: 'ids must be a non-empty array' })
    .refine((arr) => new Set(arr).size === arr.length, {
      error: 'ids must not contain duplicates',
    }),
});

/** GET /api/notes query parameters. */
export const listNotesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).catch(10),
  q: z.string().optional().catch(undefined),
  tag: z.string().optional().catch(undefined),
  sort: z
    .enum(['newest', 'oldest', 'title'], {
      error: 'sort must be one of: newest, oldest, title',
    })
    .optional(),
  archived: z.enum(['true', 'false'], { error: 'archived must be "true" or "false"' }).optional(),
  tags: z.string().optional().catch(undefined),
  tagMode: z.enum(['and', 'or']).catch('or'),
});

/** Result of a validation attempt. */
export type ValidationFailure = {
  error: string;
  details: Array<{ field: string; message: string }>;
};

/**
 * Parse `data` with `schema`. On success returns `{ ok: true, data }`; on
 * failure returns `{ ok: false, failure }` where `failure.error` is the first
 * issue's message (preserving the historical single-string contract) and
 * `failure.details` lists every field-level issue.
 */
export function parse<T>(
  schema: ZodType<T>,
  data: unknown,
): { ok: true; data: T } | { ok: false; failure: ValidationFailure } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const issues = result.error.issues;
  const details = issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
  return { ok: false, failure: { error: issues[0].message, details } };
}
