import { type Database as DatabaseType, type Statement } from 'better-sqlite3';
import { openDatabase, resolveDbPath } from './db.js';

/** Fixed palette of named color labels. */
export const NOTE_COLORS = ['none', 'red', 'yellow', 'green', 'blue', 'purple'] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

/**
 * Fixed palette of named colors a tag may carry. Independent of NOTE_COLORS:
 * tag colors decorate the tag chips, note colors decorate the card itself.
 */
export const TAG_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'] as const;
export type TagColor = (typeof TAG_COLORS)[number];

export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: number;
  pinned: boolean;
  archived: boolean;
  color: NoteColor;
  deletedAt: number | null;
}

export interface Attachment {
  /** Original filename supplied by the client — stored only as metadata. */
  filename: string;
  /** MIME content type validated at upload time. */
  contentType: string;
  /** Byte length of the file data. */
  size: number;
  /** Raw file bytes. */
  data: Buffer;
}

export interface AttachmentMeta {
  filename: string;
  contentType: string;
  size: number;
}

export interface ListResult {
  items: Note[];
  /** Total number of notes matching the current filter, across all pages. */
  total: number;
  /** Total number of pages for the current filter and pageSize (always >= 1). */
  totalPages: number;
  /** True when a page after the current one exists. */
  hasNext: boolean;
}

/** Valid values for the sort query parameter. */
export type SortOrder = 'newest' | 'oldest' | 'title';

/** Valid values for the tagMode query parameter. */
export type TagMode = 'and' | 'or';

/** Construction options for {@link NoteStore}. */
export interface NoteStoreOptions {
  /**
   * Filesystem path to the SQLite database file. When omitted, falls back to
   * the `NOTES_DB_PATH` environment variable, and finally to an in-memory
   * database (`:memory:`) — the default that keeps tests hermetic.
   */
  path?: string;
}

/** Row shape as stored in the `notes` table (integers for booleans). */
interface NoteRow {
  id: string;
  title: string;
  body: string;
  tags: string;
  createdAt: number;
  pinned: number;
  archived: number;
  color: string;
  deletedAt: number | null;
}

/**
 * Persistent note store backed by SQLite (via better-sqlite3, a synchronous
 * driver — so every method keeps its original synchronous contract). The public
 * API is unchanged from the former in-memory implementation; only the storage
 * backend differs. Notes, attachments and tag colors all survive a restart when
 * a file-backed database is used.
 */
export class NoteStore {
  private readonly db: DatabaseType;

  /** Maximum number of attachments allowed per note. */
  static readonly MAX_ATTACHMENTS_PER_NOTE = 20;

  // Prepared statements, compiled once per connection.
  private readonly stmtInsertNote: Statement;
  private readonly stmtGetNote: Statement;
  private readonly stmtUpdateNote: Statement;
  private readonly stmtDeleteNote: Statement;
  private readonly stmtAllNotes: Statement;
  private readonly stmtGetSeq: Statement;
  private readonly stmtSetSeq: Statement;
  private readonly stmtInsertAttachment: Statement;
  private readonly stmtGetAttachment: Statement;
  private readonly stmtHasAttachment: Statement;
  private readonly stmtDeleteAttachment: Statement;
  private readonly stmtDeleteAttachmentsForNote: Statement;
  private readonly stmtCountAttachments: Statement;
  private readonly stmtListAttachments: Statement;
  private readonly stmtGetTagColor: Statement;
  private readonly stmtSetTagColor: Statement;
  private readonly stmtDeleteTagColor: Statement;

  constructor(options: NoteStoreOptions = {}) {
    this.db = openDatabase(resolveDbPath(options.path));

    this.stmtInsertNote = this.db.prepare(
      `INSERT INTO notes (id, title, body, tags, createdAt, pinned, archived, color, deletedAt)
       VALUES (@id, @title, @body, @tags, @createdAt, @pinned, @archived, @color, @deletedAt)`,
    );
    this.stmtGetNote = this.db.prepare(`SELECT * FROM notes WHERE id = ?`);
    this.stmtUpdateNote = this.db.prepare(
      `UPDATE notes SET title = @title, body = @body, tags = @tags, pinned = @pinned,
         archived = @archived, color = @color, deletedAt = @deletedAt WHERE id = @id`,
    );
    this.stmtDeleteNote = this.db.prepare(`DELETE FROM notes WHERE id = ?`);
    this.stmtAllNotes = this.db.prepare(`SELECT * FROM notes`);
    this.stmtGetSeq = this.db.prepare(`SELECT value FROM meta WHERE key = 'seq'`);
    this.stmtSetSeq = this.db.prepare(`UPDATE meta SET value = ? WHERE key = 'seq'`);

    this.stmtInsertAttachment = this.db.prepare(
      `INSERT INTO attachments (key, noteId, filename, contentType, size, data)
       VALUES (@key, @noteId, @filename, @contentType, @size, @data)`,
    );
    this.stmtGetAttachment = this.db.prepare(`SELECT * FROM attachments WHERE key = ?`);
    this.stmtHasAttachment = this.db.prepare(`SELECT 1 FROM attachments WHERE key = ?`);
    this.stmtDeleteAttachment = this.db.prepare(`DELETE FROM attachments WHERE key = ?`);
    this.stmtDeleteAttachmentsForNote = this.db.prepare(`DELETE FROM attachments WHERE noteId = ?`);
    this.stmtCountAttachments = this.db.prepare(
      `SELECT COUNT(*) AS n FROM attachments WHERE noteId = ?`,
    );
    this.stmtListAttachments = this.db.prepare(
      `SELECT filename, contentType, size FROM attachments WHERE noteId = ?`,
    );

    this.stmtGetTagColor = this.db.prepare(`SELECT color FROM tag_colors WHERE tag = ?`);
    this.stmtSetTagColor = this.db.prepare(
      `INSERT INTO tag_colors (tag, color) VALUES (?, ?)
       ON CONFLICT(tag) DO UPDATE SET color = excluded.color`,
    );
    this.stmtDeleteTagColor = this.db.prepare(`DELETE FROM tag_colors WHERE tag = ?`);
  }

  /** Materialise a database row into the public {@link Note} shape. */
  private rowToNote(row: NoteRow): Note {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      tags: JSON.parse(row.tags) as string[],
      createdAt: row.createdAt,
      pinned: row.pinned === 1,
      archived: row.archived === 1,
      color: row.color as NoteColor,
      deletedAt: row.deletedAt,
    };
  }

  /** Read the persisted monotonic sequence counter. */
  private currentSeq(): number {
    return (this.stmtGetSeq.get() as { value: number }).value;
  }

  /** Persist the next monotonic sequence value and return it. */
  private nextSeq(): number {
    const next = this.currentSeq() + 1;
    this.stmtSetSeq.run(next);
    return next;
  }

  private getRow(id: string): NoteRow | undefined {
    return this.stmtGetNote.get(id) as NoteRow | undefined;
  }

  private hasNote(id: string): boolean {
    return this.getRow(id) !== undefined;
  }

  /** Write the full note back to the row (used by every mutator). */
  private putNote(note: Note): void {
    this.stmtUpdateNote.run({
      id: note.id,
      title: note.title,
      body: note.body,
      tags: JSON.stringify(note.tags),
      pinned: note.pinned ? 1 : 0,
      archived: note.archived ? 1 : 0,
      color: note.color,
      deletedAt: note.deletedAt,
    });
  }

  create(input: { title: string; body: string; tags?: string[]; color?: NoteColor }): Note {
    const seq = this.nextSeq();
    const note: Note = {
      id: String(seq),
      title: input.title,
      body: input.body,
      tags: input.tags ?? [],
      // monotonic insertion counter — used purely for stable list ordering,
      // not a wall-clock timestamp (keeps pagination deterministic in tests)
      createdAt: seq,
      pinned: false,
      archived: false,
      color: input.color ?? 'none',
      deletedAt: null,
    };
    this.stmtInsertNote.run({
      id: note.id,
      title: note.title,
      body: note.body,
      tags: JSON.stringify(note.tags),
      createdAt: note.createdAt,
      pinned: 0,
      archived: 0,
      color: note.color,
      deletedAt: null,
    });
    return note;
  }

  get(id: string): Note | undefined {
    const row = this.getRow(id);
    return row ? this.rowToNote(row) : undefined;
  }

  update(
    id: string,
    input: { title?: string; body?: string; tags?: string[]; color?: NoteColor },
  ): Note | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    const updated: Note = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    };
    this.putNote(updated);
    return updated;
  }

  /**
   * Duplicate an existing note: copies title (prefixed "Copy of …"), body,
   * tags, and color into a brand-new note.  The duplicate gets its own id and
   * createdAt timestamp, is not pinned, and does not inherit any attachments.
   * Returns undefined when the source note does not exist.
   */
  duplicate(id: string): Note | undefined {
    const source = this.get(id);
    if (!source) return undefined;
    return this.create({
      title: `Copy of ${source.title}`,
      body: source.body,
      tags: [...source.tags],
      color: source.color,
    });
  }

  togglePin(id: string): Note | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    const updated: Note = { ...existing, pinned: !existing.pinned };
    this.putNote(updated);
    return updated;
  }

  toggleArchive(id: string): Note | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    const updated: Note = { ...existing, archived: !existing.archived };
    this.putNote(updated);
    return updated;
  }

  /**
   * Explicitly set a note's archived flag (idempotent). Unlike
   * {@link toggleArchive}, the resulting state does not depend on the prior
   * state, which makes it safe for bulk operations where the caller wants a
   * deterministic outcome regardless of each note's starting point.
   * Returns the updated note, or undefined if the note does not exist.
   */
  setArchived(id: string, archived: boolean): Note | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    const updated: Note = { ...existing, archived };
    this.putNote(updated);
    return updated;
  }

  /**
   * Add a tag to a single note (idempotent — a tag already present is left
   * untouched). Returns the updated note, or undefined if the note does not
   * exist. The tag is assumed to be validated/trimmed by the caller.
   */
  addTagToNote(id: string, tag: string): Note | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    if (existing.tags.includes(tag)) return existing;
    const updated: Note = { ...existing, tags: [...existing.tags, tag] };
    this.putNote(updated);
    return updated;
  }

  /**
   * Remove a tag from a single note (idempotent — a tag that is absent leaves
   * the note unchanged). Returns the updated note, or undefined if the note
   * does not exist.
   */
  removeTagFromNote(id: string, tag: string): Note | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    if (!existing.tags.includes(tag)) return existing;
    const updated: Note = { ...existing, tags: existing.tags.filter((t) => t !== tag) };
    this.putNote(updated);
    return updated;
  }

  /**
   * Soft-delete: move a note to trash by setting `deletedAt` to the current
   * wall-clock timestamp.  Returns the updated note, or undefined if missing.
   */
  trash(id: string): Note | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    const updated: Note = { ...existing, deletedAt: Date.now() };
    this.putNote(updated);
    return updated;
  }

  /**
   * Restore a trashed note back to the active list by clearing `deletedAt`.
   * Returns the updated note, or undefined if the note does not exist.
   */
  restore(id: string): Note | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    const updated: Note = { ...existing, deletedAt: null };
    this.putNote(updated);
    return updated;
  }

  /**
   * Permanently delete a note and all its attachments from the store.
   * Returns true on success, false if the note was not found.
   */
  permanentDelete(id: string): boolean {
    const info = this.stmtDeleteNote.run(id);
    if (info.changes === 0) return false;
    // Remove all attachments belonging to this note
    this.stmtDeleteAttachmentsForNote.run(id);
    return true;
  }

  /**
   * @deprecated Use `permanentDelete` for hard removal. Kept for internal use
   * (e.g. by tag management) where notes are not user-visible and soft-delete
   * semantics don't apply.
   */
  delete(id: string): boolean {
    return this.permanentDelete(id);
  }

  /**
   * Sanitise the client-supplied filename to a safe basename.
   * Strips path separators, control characters, double-quotes, backslashes,
   * and leading dots so the result is safe for use as a storage key and safe
   * to embed in HTTP header values.
   */
  private sanitiseFilename(raw: string): string {
    // Strip path separators, control chars (0x00–0x1f), double-quotes,
    // and backslashes; collapse leading dots.
    const base = raw
      .replace(/[/\\]/g, '_')
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f"\\]/g, '_')
      .replace(/^\.+/, '')
      .trim();
    return base || 'attachment';
  }

  addAttachment(
    noteId: string,
    input: { filename: string; contentType: string; data: Buffer },
  ): AttachmentMeta | undefined {
    if (!this.hasNote(noteId)) return undefined;

    // Enforce per-note attachment cap.
    if (this.attachmentCount(noteId) >= NoteStore.MAX_ATTACHMENTS_PER_NOTE) return undefined;

    let safeName = this.sanitiseFilename(input.filename);
    let key = `${noteId}/${safeName}`;

    // Avoid silent overwrite on collision — append a numeric suffix.
    if (this.attachmentKeyExists(key)) {
      const dot = safeName.lastIndexOf('.');
      const stem = dot > 0 ? safeName.slice(0, dot) : safeName;
      const ext = dot > 0 ? safeName.slice(dot) : '';
      let i = 1;
      while (this.attachmentKeyExists(`${noteId}/${stem}-${i}${ext}`)) i++;
      safeName = `${stem}-${i}${ext}`;
      key = `${noteId}/${safeName}`;
    }

    const size = input.data.byteLength;
    this.stmtInsertAttachment.run({
      key,
      noteId,
      filename: safeName,
      contentType: input.contentType,
      size,
      data: input.data,
    });
    return { filename: safeName, contentType: input.contentType, size };
  }

  private attachmentKeyExists(key: string): boolean {
    return this.stmtHasAttachment.get(key) !== undefined;
  }

  /** Returns the number of attachments currently stored for the given note. */
  attachmentCount(noteId: string): number {
    return (this.stmtCountAttachments.get(noteId) as { n: number }).n;
  }

  getAttachment(noteId: string, filename: string): Attachment | undefined {
    if (!this.hasNote(noteId)) return undefined;
    const safeName = this.sanitiseFilename(filename);
    const row = this.stmtGetAttachment.get(`${noteId}/${safeName}`) as
      | { filename: string; contentType: string; size: number; data: Buffer }
      | undefined;
    if (!row) return undefined;
    return {
      filename: row.filename,
      contentType: row.contentType,
      size: row.size,
      data: row.data,
    };
  }

  /**
   * Delete a single attachment from a note.
   * Returns `true` if deleted, `false` if the note exists but the attachment
   * does not, and `undefined` if the note itself does not exist.
   */
  deleteAttachment(noteId: string, filename: string): boolean | undefined {
    if (!this.hasNote(noteId)) return undefined;
    const safeName = this.sanitiseFilename(filename);
    return this.stmtDeleteAttachment.run(`${noteId}/${safeName}`).changes > 0;
  }

  listAttachments(noteId: string): AttachmentMeta[] | undefined {
    if (!this.hasNote(noteId)) return undefined;
    const rows = this.stmtListAttachments.all(noteId) as AttachmentMeta[];
    return rows.map((r) => ({ filename: r.filename, contentType: r.contentType, size: r.size }));
  }

  /** Load every note row as materialised {@link Note} objects. */
  private allNotes(): Note[] {
    return (this.stmtAllNotes.all() as NoteRow[]).map((row) => this.rowToNote(row));
  }

  /**
   * Return every unique tag currently in use, paired with how many notes carry
   * it and its assigned color (or null when none has been set). Trashed notes
   * are excluded. Results are sorted alphabetically by tag name.
   */
  listTags(): Array<{ tag: string; count: number; color: TagColor | null }> {
    const counts = new Map<string, number>();
    for (const note of this.allNotes()) {
      if (note.deletedAt !== null) continue; // exclude trashed notes
      for (const tag of note.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count, color: this.getTagColor(tag) ?? null }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
  }

  /**
   * Assign a color to a tag (overwriting any previous color). The tag does not
   * need to be in use by any note for a color to be stored.
   */
  setTagColor(tag: string, color: TagColor): void {
    this.stmtSetTagColor.run(tag, color);
  }

  /** Return the color assigned to a tag, or undefined when none is set. */
  getTagColor(tag: string): TagColor | undefined {
    const row = this.stmtGetTagColor.get(tag) as { color: TagColor } | undefined;
    return row?.color;
  }

  /**
   * Rename a tag across every note that carries it.
   * Returns the number of notes that were updated.
   * Callers are responsible for verifying that `to` does not already exist as a
   * separate tag before calling this method.
   */
  renameTag(from: string, to: string): number {
    let affected = 0;
    for (const note of this.allNotes()) {
      if (note.tags.includes(from)) {
        const newTags = note.tags.map((t) => (t === from ? to : t));
        this.putNote({ ...note, tags: newTags });
        affected++;
      }
    }
    // Carry any assigned color across to the new name so the chip keeps its
    // appearance after a rename.
    const color = this.getTagColor(from);
    if (color !== undefined) {
      this.stmtDeleteTagColor.run(from);
      this.setTagColor(to, color);
    }
    return affected;
  }

  /**
   * Merge the `from` tag into the `to` tag across every note.
   *
   * Each note carrying `from` has it replaced by `to`, deduplicating so a note
   * that already had both ends up with a single `to`. Notes that only had `to`
   * are left untouched. The `from` tag's stored color (if any) is dropped; `to`
   * keeps whatever color it already had. Returns the number of notes modified.
   */
  mergeTag(from: string, to: string): number {
    let affected = 0;
    for (const note of this.allNotes()) {
      if (!note.tags.includes(from)) continue;
      // Replace `from` with `to`, then dedupe so a note already carrying both
      // ends up with a single `to`.
      const newTags = [...new Set(note.tags.map((t) => (t === from ? to : t)))];
      this.putNote({ ...note, tags: newTags });
      affected++;
    }
    // The source tag disappears, so drop any color it carried; the target keeps
    // its own color.
    this.stmtDeleteTagColor.run(from);
    return affected;
  }

  /**
   * Delete a tag from every note that carries it.
   * Returns the number of notes that were modified.
   */
  deleteTag(tag: string): number {
    let affected = 0;
    for (const note of this.allNotes()) {
      if (note.tags.includes(tag)) {
        this.putNote({ ...note, tags: note.tags.filter((t) => t !== tag) });
        affected++;
      }
    }
    // Drop any stored color for the removed tag.
    this.stmtDeleteTagColor.run(tag);
    return affected;
  }

  /** Test-only: clear all notes and attachments and reset the id sequence. */
  reset(): void {
    this.db.exec('DELETE FROM notes; DELETE FROM attachments; DELETE FROM tag_colors;');
    this.stmtSetSeq.run(0);
  }

  list(
    page: number,
    pageSize: number,
    query?: string,
    tag?: string,
    sort: SortOrder = 'newest',
    archived = false,
    tags?: string[],
    tagMode: TagMode = 'or',
  ): ListResult {
    const term = query ? query.trim().toLowerCase() : '';
    const tagFilter = tag ? tag.trim().toLowerCase() : '';
    // Normalise the multi-tag list to lowercase; empty array = no filter.
    const multiTags = (tags ?? []).map((t) => t.toLowerCase()).filter((t) => t !== '');
    const all = this.allNotes()
      .sort((a, b) => {
        // Pinned notes always sort before unpinned regardless of secondary sort.
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        // Within each pin group apply the requested secondary sort.
        if (sort === 'oldest') return a.createdAt - b.createdAt;
        if (sort === 'title') return a.title.localeCompare(b.title);
        // 'newest' (default): most recently created first
        return b.createdAt - a.createdAt;
      })
      .filter((n) => {
        // Trashed notes never appear in the standard list views
        if (n.deletedAt !== null) return false;
        if (n.archived !== archived) return false;
        if (
          term !== '' &&
          !n.title.toLowerCase().includes(term) &&
          !n.body.toLowerCase().includes(term)
        )
          return false;
        // Legacy single-tag filter (backward-compatible).
        if (tagFilter !== '' && !n.tags.some((t) => t.toLowerCase() === tagFilter)) return false;
        // Multi-tag filter.
        if (multiTags.length > 0) {
          const noteLower = n.tags.map((t) => t.toLowerCase());
          if (tagMode === 'and') {
            if (!multiTags.every((mt) => noteLower.includes(mt))) return false;
          } else {
            if (!multiTags.some((mt) => noteLower.includes(mt))) return false;
          }
        }
        return true;
      });
    const total = all.length;
    const start = (page - 1) * pageSize;
    // Always at least 1 page so the client never displays "Page 1 of 0".
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const hasNext = page < totalPages;
    return { items: all.slice(start, start + pageSize), total, totalPages, hasNext };
  }

  /**
   * Return all trashed notes (those with a non-null `deletedAt`), sorted by
   * most-recently trashed first.
   */
  listTrashed(): Note[] {
    return this.allNotes()
      .filter((n) => n.deletedAt !== null)
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  }

  /**
   * Permanently remove every trashed note whose `deletedAt` is older than the
   * retention window — i.e. notes trashed at or before `now - retentionMs`.
   * Active and archived notes are never touched (only notes with a non-null
   * `deletedAt` are considered). Each purged note's attachments are removed too
   * (via {@link permanentDelete}). Returns the number of notes purged.
   *
   * @param retentionMs Retention window in milliseconds. A non-positive value
   *   purges every trashed note immediately.
   * @param now Reference timestamp (defaults to the current wall clock);
   *   injectable so tests can drive the boundary deterministically.
   */
  purgeExpiredTrash(retentionMs: number, now: number = Date.now()): number {
    const cutoff = now - retentionMs;
    let purged = 0;
    for (const note of this.allNotes()) {
      // Only trashed notes are eligible; active/archived notes are left intact.
      if (note.deletedAt === null) continue;
      if (note.deletedAt <= cutoff) {
        this.permanentDelete(note.id);
        purged += 1;
      }
    }
    return purged;
  }
}
