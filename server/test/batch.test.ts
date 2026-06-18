// test/batch.test.ts
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { NoteStore } from '../src/store';

/** Create `n` notes and return their ids in creation order. */
async function seedNotes(app: ReturnType<typeof createApp>, n: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const res = await request(app)
      .post('/api/notes')
      .send({ title: `t${i}`, body: 'b' })
      .expect(201);
    ids.push(res.body.id as string);
  }
  return ids;
}

describe('POST /api/notes/batch — validation', () => {
  it('rejects a non-object payload', async () => {
    const app = createApp();
    await request(app).post('/api/notes/batch').send([]).expect(400);
  });

  it('rejects a missing or empty ids array', async () => {
    const app = createApp();
    await request(app).post('/api/notes/batch').send({ action: 'archive' }).expect(400);
    await request(app).post('/api/notes/batch').send({ ids: [], action: 'archive' }).expect(400);
  });

  it('rejects ids that are not all non-empty strings', async () => {
    const app = createApp();
    await request(app)
      .post('/api/notes/batch')
      .send({ ids: [1, 2], action: 'archive' })
      .expect(400);
    await request(app)
      .post('/api/notes/batch')
      .send({ ids: ['ok', '  '], action: 'archive' })
      .expect(400);
  });

  it('rejects an unknown action', async () => {
    const app = createApp();
    await request(app)
      .post('/api/notes/batch')
      .send({ ids: ['1'], action: 'frobnicate' })
      .expect(400);
  });

  it('rejects more than the maximum number of ids', async () => {
    const app = createApp();
    const ids = Array.from({ length: 1001 }, (_, i) => `id-${i}`);
    await request(app).post('/api/notes/batch').send({ ids, action: 'archive' }).expect(400);
  });

  it('requires a non-empty tag for tag actions', async () => {
    const app = createApp();
    await request(app)
      .post('/api/notes/batch')
      .send({ ids: ['1'], action: 'add-tag' })
      .expect(400);
    await request(app)
      .post('/api/notes/batch')
      .send({ ids: ['1'], action: 'remove-tag', tag: '   ' })
      .expect(400);
  });

  it('rejects a tag supplied for a non-tag action', async () => {
    const app = createApp();
    await request(app)
      .post('/api/notes/batch')
      .send({ ids: ['1'], action: 'archive', tag: 'x' })
      .expect(400);
  });
});

describe('POST /api/notes/batch — archive / unarchive', () => {
  it('archives many notes and reports all as succeeded', async () => {
    const store = new NoteStore();
    const app = createApp(store);
    const ids = await seedNotes(app, 3);

    const res = await request(app)
      .post('/api/notes/batch')
      .send({ ids, action: 'archive' })
      .expect(200);

    expect(res.body.action).toBe('archive');
    expect(res.body.succeeded).toEqual(ids);
    expect(res.body.failed).toEqual([]);
    for (const id of ids) {
      expect(store.get(id)?.archived).toBe(true);
    }
  });

  it('unarchives is idempotent regardless of starting state', async () => {
    const store = new NoteStore();
    const app = createApp(store);
    const ids = await seedNotes(app, 2);
    // Archive only the first.
    store.setArchived(ids[0], true);

    await request(app).post('/api/notes/batch').send({ ids, action: 'unarchive' }).expect(200);

    for (const id of ids) {
      expect(store.get(id)?.archived).toBe(false);
    }
  });
});

describe('POST /api/notes/batch — trash / restore', () => {
  it('trashes notes so they leave the active list', async () => {
    const store = new NoteStore();
    const app = createApp(store);
    const ids = await seedNotes(app, 2);

    const res = await request(app)
      .post('/api/notes/batch')
      .send({ ids, action: 'trash' })
      .expect(200);
    expect(res.body.succeeded).toEqual(ids);
    expect(store.list(1, 10).total).toBe(0);
    expect(store.listTrashed()).toHaveLength(2);
  });

  it('restores trashed notes back to the active list', async () => {
    const store = new NoteStore();
    const app = createApp(store);
    const ids = await seedNotes(app, 2);
    for (const id of ids) store.trash(id);

    await request(app).post('/api/notes/batch').send({ ids, action: 'restore' }).expect(200);
    expect(store.list(1, 10).total).toBe(2);
    expect(store.listTrashed()).toHaveLength(0);
  });
});

describe('POST /api/notes/batch — add-tag / remove-tag', () => {
  it('adds a tag to each note (idempotent)', async () => {
    const store = new NoteStore();
    const app = createApp(store);
    const ids = await seedNotes(app, 2);
    // Pre-tag one note so we exercise the idempotent path.
    store.addTagToNote(ids[0], 'urgent');

    const res = await request(app)
      .post('/api/notes/batch')
      .send({ ids, action: 'add-tag', tag: ' urgent ' })
      .expect(200);

    expect(res.body.succeeded).toEqual(ids);
    for (const id of ids) {
      expect(store.get(id)?.tags).toEqual(['urgent']);
    }
  });

  it('removes a tag from each note that carries it', async () => {
    const store = new NoteStore();
    const app = createApp(store);
    const ids = await seedNotes(app, 2);
    store.addTagToNote(ids[0], 'old');

    const res = await request(app)
      .post('/api/notes/batch')
      .send({ ids, action: 'remove-tag', tag: 'old' })
      .expect(200);

    expect(res.body.succeeded).toEqual(ids);
    expect(store.get(ids[0])?.tags).toEqual([]);
    expect(store.get(ids[1])?.tags).toEqual([]);
  });
});

describe('POST /api/notes/batch — partial failures', () => {
  it('reports missing ids as failed while applying the rest', async () => {
    const store = new NoteStore();
    const app = createApp(store);
    const [real] = await seedNotes(app, 1);

    const res = await request(app)
      .post('/api/notes/batch')
      .send({ ids: [real, 'does-not-exist'], action: 'archive' })
      .expect(200);

    expect(res.body.succeeded).toEqual([real]);
    expect(res.body.failed).toEqual([{ id: 'does-not-exist', reason: 'not found' }]);
    expect(store.get(real)?.archived).toBe(true);
  });

  it('de-duplicates repeated ids in the request', async () => {
    const store = new NoteStore();
    const app = createApp(store);
    const [real] = await seedNotes(app, 1);

    const res = await request(app)
      .post('/api/notes/batch')
      .send({ ids: [real, real], action: 'archive' })
      .expect(200);

    expect(res.body.succeeded).toEqual([real]);
  });
});
