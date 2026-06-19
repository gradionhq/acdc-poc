import type { Note } from './api';

/** Supported export serialization formats. */
export type ExportFormat = 'md' | 'json';

/** Fields included when exporting a note. Excludes transient/internal state. */
interface ExportedNote {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  color: string;
}

function toExported(note: Note): ExportedNote {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    tags: note.tags,
    pinned: note.pinned,
    archived: note.archived,
    color: note.color,
  };
}

/** Render a single note as a Markdown document. */
function noteToMarkdown(note: Note): string {
  const title = note.title.trim() === '' ? 'Untitled note' : note.title;
  const lines: string[] = [`# ${title}`];

  if (note.tags.length > 0) {
    const tagList = note.tags.map((t) => '#' + t).join(' ');
    lines.push('', `Tags: ${tagList}`);
  }

  // Body is already user-authored Markdown; emit it verbatim under the title.
  lines.push('', note.body);

  // Collapse to a single trailing newline so files are tidy and stable.
  // Strip trailing whitespace one character at a time to avoid backtracking.
  const joined = lines.join('\n');
  let end = joined.length;
  while (end > 0 && /\s/.test(joined[end - 1])) {
    end -= 1;
  }
  return `${joined.slice(0, end)}\n`;
}

/**
 * Serialize one or more notes into the chosen format.
 *
 * - `json`: a pretty-printed array of notes (always an array, even for one note).
 * - `md`: Markdown documents separated by a horizontal rule when multiple.
 */
export function serializeNotes(notes: Note[], format: ExportFormat): string {
  if (format === 'json') {
    return `${JSON.stringify(notes.map(toExported), null, 2)}\n`;
  }
  return notes.map(noteToMarkdown).join('\n---\n\n');
}

/**
 * Derive a filesystem-safe filename from a note title (or a generic name for a
 * collection). Strips characters illegal on common filesystems, collapses
 * whitespace to hyphens, and guarantees a non-empty base name.
 */
export function exportFilename(note: Note | null, format: ExportFormat): string {
  const ext = format === 'json' ? 'json' : 'md';
  if (note === null) {
    return `notes.${ext}`;
  }

  const base = note.title
    .trim()
    .toLowerCase()
    // Replace any character outside a safe allow-list with a space.
    .replace(/[^a-z0-9._-]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    // Avoid leading dots producing hidden files.
    .replace(/^\.+/, '');

  const safe = base === '' ? 'note' : base.slice(0, 100);
  return `${safe}.${ext}`;
}

/** MIME type for the given export format. */
function mimeType(format: ExportFormat): string {
  return format === 'json' ? 'application/json' : 'text/markdown';
}

/**
 * Trigger a client-side download of `content` as `filename`. Creates a Blob,
 * clicks a transient anchor, then revokes the object URL. No-op-safe to call
 * repeatedly. Separated from serialization so the latter stays pure/testable.
 */
export function downloadFile(filename: string, content: string, format: ExportFormat): void {
  const blob = new Blob([content], { type: `${mimeType(format)};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Serialize the given notes and immediately download them. `note` identifies a
 * single-note export (used for the filename); pass `null` to export a
 * collection under a generic name.
 */
export function exportNotes(notes: Note[], format: ExportFormat, single: Note | null): void {
  const content = serializeNotes(notes, format);
  downloadFile(exportFilename(single, format), content, format);
}
