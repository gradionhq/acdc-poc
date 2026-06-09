export interface Attachment {
  filename: string;
  size: number;
  contentType: string;
}

export interface StoredAttachment {
  meta: Attachment;
  data: Buffer;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  attachments: Attachment[];
}

export interface ListResult {
  items: Note[];
  total: number;
}

export class NoteStore {
  private readonly notes = new Map<string, Note>();
  // note id -> (attachment filename -> stored bytes + metadata)
  private readonly attachments = new Map<string, Map<string, StoredAttachment>>();
  private seq = 0;

  create(input: { title: string; body: string }): Note {
    this.seq += 1;
    const note: Note = {
      id: String(this.seq),
      title: input.title,
      body: input.body,
      // monotonic insertion counter — used purely for stable list ordering,
      // not a wall-clock timestamp (keeps pagination deterministic in tests)
      createdAt: this.seq,
      attachments: [],
    };
    this.notes.set(note.id, note);
    return note;
  }

  addAttachment(
    noteId: string,
    input: { filename: string; contentType: string; data: Buffer },
  ): Attachment | undefined {
    const note = this.notes.get(noteId);
    if (!note) return undefined;
    const meta: Attachment = {
      filename: input.filename,
      size: input.data.length,
      contentType: input.contentType,
    };
    let forNote = this.attachments.get(noteId);
    if (!forNote) {
      forNote = new Map<string, StoredAttachment>();
      this.attachments.set(noteId, forNote);
    }
    forNote.set(meta.filename, { meta, data: input.data });
    note.attachments = [...note.attachments.filter((a) => a.filename !== meta.filename), meta];
    return meta;
  }

  getAttachment(noteId: string, filename: string): StoredAttachment | undefined {
    return this.attachments.get(noteId)?.get(filename);
  }

  get(id: string): Note | undefined {
    return this.notes.get(id);
  }

  update(id: string, input: { title?: string; body?: string }): Note | undefined {
    const existing = this.notes.get(id);
    if (!existing) return undefined;
    const updated: Note = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
    };
    this.notes.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.notes.delete(id);
  }

  list(page: number, pageSize: number): ListResult {
    const all = [...this.notes.values()].sort((a, b) => a.createdAt - b.createdAt);
    const start = (page - 1) * pageSize;
    return { items: all.slice(start, start + pageSize), total: all.length };
  }
}
