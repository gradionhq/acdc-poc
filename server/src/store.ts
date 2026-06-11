export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: number;
  pinned: boolean;
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

export class NoteStore {
  private readonly notes = new Map<string, Note>();
  /**
   * Attachments are keyed by `${noteId}/${sanitisedFilename}`.
   * The key is constructed internally — never derived directly from client input.
   */
  private readonly attachments = new Map<string, Attachment>();
  private seq = 0;

  create(input: { title: string; body: string; tags?: string[] }): Note {
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
    };
    this.notes.set(note.id, note);
    return note;
  }

  get(id: string): Note | undefined {
    return this.notes.get(id);
  }

  update(id: string, input: { title?: string; body?: string; tags?: string[] }): Note | undefined {
    const existing = this.notes.get(id);
    if (!existing) return undefined;
    const updated: Note = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
    };
    this.notes.set(id, updated);
    return updated;
  }

  /**
   * Duplicate an existing note: copies title (prefixed "Copy of …"), body, and
   * tags into a brand-new note.  The duplicate gets its own id and createdAt
   * timestamp, is not pinned, and does not inherit any attachments.
   * Returns undefined when the source note does not exist.
   */
  duplicate(id: string): Note | undefined {
    const source = this.notes.get(id);
    if (!source) return undefined;
    return this.create({
      title: `Copy of ${source.title}`,
      body: source.body,
      tags: [...source.tags],
    });
  }

  togglePin(id: string): Note | undefined {
    const existing = this.notes.get(id);
    if (!existing) return undefined;
    const updated: Note = { ...existing, pinned: !existing.pinned };
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

  /** Test-only: clear all notes and attachments and reset the id sequence. */
  reset(): void {
    this.notes.clear();
    this.attachments.clear();
    this.seq = 0;
  }

  list(page: number, pageSize: number, query?: string, tag?: string): ListResult {
    const term = query ? query.trim().toLowerCase() : '';
    const tagFilter = tag ? tag.trim().toLowerCase() : '';
    const all = [...this.notes.values()]
      .sort((a, b) => {
        // Pinned notes sort before unpinned; within each group preserve
        // insertion order (createdAt ascending).
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return a.createdAt - b.createdAt;
      })
      .filter(
        (n) =>
          (term === '' ||
            n.title.toLowerCase().includes(term) ||
            n.body.toLowerCase().includes(term)) &&
          (tagFilter === '' || n.tags.some((t) => t.toLowerCase() === tagFilter)),
      );
    const start = (page - 1) * pageSize;
    return { items: all.slice(start, start + pageSize), total: all.length };
  }
}
