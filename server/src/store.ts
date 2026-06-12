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
}

export interface Attachment {
  /** Original filename supplied by the client — stored only as metadata. */
  filename: string;
  /** MIME content type validated at upload time. */
  contentType: string;
  /** Byte length of the file data. */
  size: number;
  /** Raw file bytes held in memory. */
  data: Buffer;
}

export interface AttachmentMeta {
  filename: string;
  contentType: string;
  size: number;
}

export interface ListResult {
  items: Note[];
  total: number;
}

/** Valid values for the sort query parameter. */
export type SortOrder = 'newest' | 'oldest' | 'title';

/** Valid values for the tagMode query parameter. */
export type TagMode = 'and' | 'or';

export class NoteStore {
  private readonly notes = new Map<string, Note>();
  /**
   * Attachments are keyed by `${noteId}/${sanitisedFilename}`.
   * The key is constructed internally — never derived directly from client input.
   */
  private readonly attachments = new Map<string, Attachment>();
  /**
   * Optional per-tag color, keyed by tag name. A tag is absent from this map
   * until a color is explicitly assigned; absence means "use the default chip
   * style". Independent of note colors.
   */
  private readonly tagColors = new Map<string, TagColor>();
  private seq = 0;

  create(input: { title: string; body: string; tags?: string[]; color?: NoteColor }): Note {
    this.seq += 1;
    const note: Note = {
      id: String(this.seq),
      title: input.title,
      body: input.body,
      tags: input.tags ?? [],
      // monotonic insertion counter — used purely for stable list ordering,
      // not a wall-clock timestamp (keeps pagination deterministic in tests)
      createdAt: this.seq,
      pinned: false,
      archived: false,
      color: input.color ?? 'none',
    };
    this.notes.set(note.id, note);
    return note;
  }

  get(id: string): Note | undefined {
    return this.notes.get(id);
  }

  update(
    id: string,
    input: { title?: string; body?: string; tags?: string[]; color?: NoteColor },
  ): Note | undefined {
    const existing = this.notes.get(id);
    if (!existing) return undefined;
    const updated: Note = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    };
    this.notes.set(id, updated);
    return updated;
  }

  /**
   * Duplicate an existing note: copies title (prefixed "Copy of …"), body,
   * tags, and color into a brand-new note.  The duplicate gets its own id and
   * createdAt timestamp, is not pinned, and does not inherit any attachments.
   * Returns undefined when the source note does not exist.
   */
  duplicate(id: string): Note | undefined {
    const source = this.notes.get(id);
    if (!source) return undefined;
    return this.create({
      title: `Copy of ${source.title}`,
      body: source.body,
      tags: [...source.tags],
      color: source.color,
    });
  }

  togglePin(id: string): Note | undefined {
    const existing = this.notes.get(id);
    if (!existing) return undefined;
    const updated: Note = { ...existing, pinned: !existing.pinned };
    this.notes.set(id, updated);
    return updated;
  }

  toggleArchive(id: string): Note | undefined {
    const existing = this.notes.get(id);
    if (!existing) return undefined;
    const updated: Note = { ...existing, archived: !existing.archived };
    this.notes.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    if (!this.notes.delete(id)) return false;
    // Remove all attachments belonging to this note
    for (const key of this.attachments.keys()) {
      if (key.startsWith(`${id}/`)) {
        this.attachments.delete(key);
      }
    }
    return true;
  }

  /** Maximum number of attachments allowed per note. */
  static readonly MAX_ATTACHMENTS_PER_NOTE = 20;

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
    if (!this.notes.has(noteId)) return undefined;

    // Enforce per-note attachment cap.
    const prefix = `${noteId}/`;
    const existingCount = [...this.attachments.keys()].filter((k) => k.startsWith(prefix)).length;
    if (existingCount >= NoteStore.MAX_ATTACHMENTS_PER_NOTE) return undefined;

    let safeName = this.sanitiseFilename(input.filename);
    let key = `${noteId}/${safeName}`;

    // Avoid silent overwrite on collision — append a numeric suffix.
    if (this.attachments.has(key)) {
      const dot = safeName.lastIndexOf('.');
      const stem = dot > 0 ? safeName.slice(0, dot) : safeName;
      const ext = dot > 0 ? safeName.slice(dot) : '';
      let i = 1;
      while (this.attachments.has(`${noteId}/${stem}-${i}${ext}`)) i++;
      safeName = `${stem}-${i}${ext}`;
      key = `${noteId}/${safeName}`;
    }

    const attachment: Attachment = {
      filename: safeName,
      contentType: input.contentType,
      size: input.data.byteLength,
      data: input.data,
    };
    this.attachments.set(key, attachment);
    return { filename: safeName, contentType: attachment.contentType, size: attachment.size };
  }

  /** Returns the number of attachments currently stored for the given note. */
  attachmentCount(noteId: string): number {
    const prefix = `${noteId}/`;
    let count = 0;
    for (const key of this.attachments.keys()) {
      if (key.startsWith(prefix)) count++;
    }
    return count;
  }

  getAttachment(noteId: string, filename: string): Attachment | undefined {
    if (!this.notes.has(noteId)) return undefined;
    const safeName = this.sanitiseFilename(filename);
    return this.attachments.get(`${noteId}/${safeName}`);
  }

  /**
   * Delete a single attachment from a note.
   * Returns `true` if deleted, `false` if the note exists but the attachment
   * does not, and `undefined` if the note itself does not exist.
   */
  deleteAttachment(noteId: string, filename: string): boolean | undefined {
    if (!this.notes.has(noteId)) return undefined;
    const safeName = this.sanitiseFilename(filename);
    return this.attachments.delete(`${noteId}/${safeName}`);
  }

  listAttachments(noteId: string): AttachmentMeta[] | undefined {
    if (!this.notes.has(noteId)) return undefined;
    const prefix = `${noteId}/`;
    const result: AttachmentMeta[] = [];
    for (const [key, att] of this.attachments) {
      if (key.startsWith(prefix)) {
        result.push({ filename: att.filename, contentType: att.contentType, size: att.size });
      }
    }
    return result;
  }

  /**
   * Return every unique tag currently in use, paired with how many notes carry
   * it and its assigned color (or null when none has been set).
   * Results are sorted alphabetically by tag name.
   */
  listTags(): Array<{ tag: string; count: number; color: TagColor | null }> {
    const counts = new Map<string, number>();
    for (const note of this.notes.values()) {
      for (const tag of note.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count, color: this.tagColors.get(tag) ?? null }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
  }

  /**
   * Assign a color to a tag (overwriting any previous color). The tag does not
   * need to be in use by any note for a color to be stored.
   */
  setTagColor(tag: string, color: TagColor): void {
    this.tagColors.set(tag, color);
  }

  /** Return the color assigned to a tag, or undefined when none is set. */
  getTagColor(tag: string): TagColor | undefined {
    return this.tagColors.get(tag);
  }

  /**
   * Rename a tag across every note that carries it.
   * Returns the number of notes that were updated.
   * Callers are responsible for verifying that `to` does not already exist as a
   * separate tag before calling this method.
   */
  renameTag(from: string, to: string): number {
    let affected = 0;
    for (const [id, note] of this.notes.entries()) {
      if (note.tags.includes(from)) {
        const newTags = note.tags.map((t) => (t === from ? to : t));
        this.notes.set(id, { ...note, tags: newTags });
        affected++;
      }
    }
    // Carry any assigned color across to the new name so the chip keeps its
    // appearance after a rename.
    const color = this.tagColors.get(from);
    if (color !== undefined) {
      this.tagColors.delete(from);
      this.tagColors.set(to, color);
    }
    return affected;
  }

  /**
   * Delete a tag from every note that carries it.
   * Returns the number of notes that were modified.
   */
  deleteTag(tag: string): number {
    let affected = 0;
    for (const [id, note] of this.notes.entries()) {
      if (note.tags.includes(tag)) {
        this.notes.set(id, { ...note, tags: note.tags.filter((t) => t !== tag) });
        affected++;
      }
    }
    // Drop any stored color for the removed tag.
    this.tagColors.delete(tag);
    return affected;
  }

  /** Test-only: clear all notes and attachments and reset the id sequence. */
  reset(): void {
    this.notes.clear();
    this.attachments.clear();
    this.tagColors.clear();
    this.seq = 0;
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
    const all = [...this.notes.values()]
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
    const start = (page - 1) * pageSize;
    return { items: all.slice(start, start + pageSize), total: all.length };
  }
}
