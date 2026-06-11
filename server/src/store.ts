export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: number;
}

export interface ListResult {
  items: Note[];
  total: number;
}

export class NoteStore {
  private readonly notes = new Map<string, Note>();
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

  delete(id: string): boolean {
    return this.notes.delete(id);
  }

  list(page: number, pageSize: number, query?: string, tag?: string): ListResult {
    const term = query ? query.trim().toLowerCase() : '';
    const tagFilter = tag ? tag.trim().toLowerCase() : '';
    const all = [...this.notes.values()]
      .sort((a, b) => a.createdAt - b.createdAt)
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
