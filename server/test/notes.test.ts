// test/notes.test.ts
import { describe, expect, it, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { NoteStore } from '../src/store';

describe('notes API', () => {
  it('creates and fetches a note', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b' })
      .expect(201);
    expect(created.body.id).toBeDefined();
    await request(app).get(`/api/notes/${created.body.id}`).expect(200);
  });

  it('rejects invalid create payloads', async () => {
    const app = createApp();
    await request(app).post('/api/notes').send({ title: 1 }).expect(400);
  });

  it('paginates 1-based and exposes total count', async () => {
    const app = createApp();
    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post('/api/notes')
        .send({ title: `t${i}`, body: 'b' })
        .expect(201);
    }
    const res = await request(app).get('/api/notes?page=1&pageSize=2').expect(200);
    expect(res.headers['x-total-count']).toBe('3');
    expect(res.body).toHaveLength(2);
  });

  it('returns 404 for unknown ids', async () => {
    const app = createApp();
    await request(app).get('/api/notes/nope').expect(404);
    await request(app).delete('/api/notes/nope').expect(404);
  });

  it('updates a note title and body via PUT', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 'original', body: 'old body' })
      .expect(201);
    const updated = await request(app)
      .put(`/api/notes/${created.body.id}`)
      .send({ title: 'updated', body: 'new body' })
      .expect(200);
    expect(updated.body.title).toBe('updated');
    expect(updated.body.body).toBe('new body');
    expect(updated.body.id).toBe(created.body.id);
  });

  it('returns 404 when PUT targets a non-existent note', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/notes/nope')
      .send({ title: 'x', body: 'y' })
      .expect(404);
    expect(res.body).toEqual({ error: 'not found' });
  });

  it('returns 400 when PUT payload has non-string fields', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b' })
      .expect(201);
    const badTitle = await request(app)
      .put(`/api/notes/${created.body.id}`)
      .send({ title: 42 })
      .expect(400);
    expect(badTitle.body).toEqual({ error: 'title must be a string' });
    const badBody = await request(app)
      .put(`/api/notes/${created.body.id}`)
      .send({ body: true })
      .expect(400);
    expect(badBody.body).toEqual({ error: 'body must be a string' });
  });

  it('returns 400 when PUT payload is empty object (no fields)', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b' })
      .expect(201);
    const res = await request(app).put(`/api/notes/${created.body.id}`).send({}).expect(400);
    expect(res.body).toEqual({ error: 'at least one of title, body, or tags is required' });
  });

  it('returns 400 when PUT payload is not an object', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b' })
      .expect(201);
    const res = await request(app)
      .put(`/api/notes/${created.body.id}`)
      .set('content-type', 'application/json')
      .send(JSON.stringify([{ title: 'x' }]))
      .expect(400);
    expect(res.body).toEqual({ error: 'payload must be an object' });
  });

  it('filters notes by q param case-insensitively', async () => {
    const app = createApp();
    await request(app).post('/api/notes').send({ title: 'Hello World', body: 'foo' }).expect(201);
    await request(app)
      .post('/api/notes')
      .send({ title: 'Goodbye', body: 'World here' })
      .expect(201);
    await request(app)
      .post('/api/notes')
      .send({ title: 'Unrelated', body: 'no match' })
      .expect(201);

    const res = await request(app).get('/api/notes?q=world').expect(200);
    expect(res.headers['x-total-count']).toBe('2');
    expect(res.body).toHaveLength(2);
    const titles = (res.body as Array<{ title: string }>).map((n) => n.title);
    expect(titles).toContain('Hello World');
    expect(titles).toContain('Goodbye');
  });

  it('returns all notes when q param is empty', async () => {
    const app = createApp();
    await request(app).post('/api/notes').send({ title: 'a', body: 'b' }).expect(201);
    await request(app).post('/api/notes').send({ title: 'c', body: 'd' }).expect(201);

    const res = await request(app).get('/api/notes?q=').expect(200);
    expect(res.headers['x-total-count']).toBe('2');
    expect(res.body).toHaveLength(2);
  });

  it('ignores non-string q param values', async () => {
    const app = createApp();
    await request(app).post('/api/notes').send({ title: 'a', body: 'b' }).expect(201);

    // q[] is an array — should be ignored, returning all notes
    const res = await request(app).get('/api/notes?q[]=foo').expect(200);
    expect(res.headers['x-total-count']).toBe('1');
  });

  it('reflects the updated note in subsequent GET and list responses', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 'before', body: 'b' })
      .expect(201);
    await request(app).put(`/api/notes/${created.body.id}`).send({ title: 'after' }).expect(200);
    const fetched = await request(app).get(`/api/notes/${created.body.id}`).expect(200);
    expect(fetched.body.title).toBe('after');
    const list = await request(app).get('/api/notes').expect(200);
    expect((list.body as Array<{ title: string }>).some((n) => n.title === 'after')).toBe(true);
  });

  it('creates a note with tags and returns them', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b', tags: ['alpha', 'beta'] })
      .expect(201);
    expect(res.body.tags).toEqual(['alpha', 'beta']);
  });

  it('creates a note with empty tags array when tags are omitted', async () => {
    const app = createApp();
    const res = await request(app).post('/api/notes').send({ title: 't', body: 'b' }).expect(201);
    expect(res.body.tags).toEqual([]);
  });

  it('rejects create with invalid tags (non-array)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b', tags: 'not-an-array' })
      .expect(400);
    expect(res.body).toEqual({ error: 'tags must be an array of non-empty strings' });
  });

  it('rejects create with tags containing empty strings', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b', tags: ['valid', ''] })
      .expect(400);
    expect(res.body).toEqual({ error: 'tags must be an array of non-empty strings' });
  });

  it('updates tags via PUT and returns updated note', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b', tags: ['old'] })
      .expect(201);
    const updated = await request(app)
      .put(`/api/notes/${created.body.id}`)
      .send({ tags: ['new', 'tag2'] })
      .expect(200);
    expect(updated.body.tags).toEqual(['new', 'tag2']);
  });

  it('rejects PUT with invalid tags', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b' })
      .expect(201);
    const res = await request(app)
      .put(`/api/notes/${created.body.id}`)
      .send({ tags: [42] })
      .expect(400);
    expect(res.body).toEqual({ error: 'tags must be an array of non-empty strings' });
  });

  it('filters notes by tag param', async () => {
    const app = createApp();
    await request(app)
      .post('/api/notes')
      .send({ title: 'tagged', body: 'b', tags: ['work'] })
      .expect(201);
    await request(app).post('/api/notes').send({ title: 'untagged', body: 'b' }).expect(201);

    const res = await request(app).get('/api/notes?tag=work').expect(200);
    expect(res.headers['x-total-count']).toBe('1');
    expect(res.body).toHaveLength(1);
    expect((res.body as Array<{ title: string }>)[0].title).toBe('tagged');
  });

  it('trims whitespace from tags before persisting', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b', tags: [' work ', '  alpha  '] })
      .expect(201);
    expect(res.body.tags).toEqual(['work', 'alpha']);
  });

  it('deduplicates tags before persisting', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b', tags: ['alpha', 'beta', 'alpha'] })
      .expect(201);
    expect(res.body.tags).toEqual(['alpha', 'beta']);
  });

  it('trims stored tags so ?tag= filter matches', async () => {
    const app = createApp();
    await request(app)
      .post('/api/notes')
      .send({ title: 'padded', body: 'b', tags: [' work '] })
      .expect(201);
    const res = await request(app).get('/api/notes?tag=work').expect(200);
    expect(res.headers['x-total-count']).toBe('1');
    expect((res.body as Array<{ title: string }>)[0].title).toBe('padded');
  });

  it('rejects create with tags containing whitespace-only strings', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b', tags: ['valid', '   '] })
      .expect(400);
    expect(res.body).toEqual({ error: 'tags must be an array of non-empty strings' });
  });

  it('creates a note with pinned=false by default', async () => {
    const app = createApp();
    const res = await request(app).post('/api/notes').send({ title: 't', body: 'b' }).expect(201);
    expect(res.body.pinned).toBe(false);
  });

  it('PATCH /api/notes/:id/pin toggles pinned true then false', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b' })
      .expect(201);
    expect(created.body.pinned).toBe(false);

    const pinned = await request(app).patch(`/api/notes/${created.body.id}/pin`).expect(200);
    expect(pinned.body.pinned).toBe(true);

    const unpinned = await request(app).patch(`/api/notes/${created.body.id}/pin`).expect(200);
    expect(unpinned.body.pinned).toBe(false);
  });

  it('PATCH /api/notes/:id/pin returns 404 for unknown id', async () => {
    const app = createApp();
    const res = await request(app).patch('/api/notes/nope/pin').expect(404);
    expect(res.body).toEqual({ error: 'not found' });
  });

  it('creates a note with a valid color and returns it', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b', color: 'red' })
      .expect(201);
    expect(res.body.color).toBe('red');
  });

  it('defaults color to "none" when color is omitted on create', async () => {
    const app = createApp();
    const res = await request(app).post('/api/notes').send({ title: 't', body: 'b' }).expect(201);
    expect(res.body.color).toBe('none');
  });

  it('rejects create with an invalid color value (400)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b', color: 'magenta' })
      .expect(400);
    expect(res.body).toEqual({
      error: 'color must be one of: none, red, yellow, green, blue, purple',
    });
  });

  it('rejects create with a non-string color value (400)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b', color: 42 })
      .expect(400);
    expect(res.body).toEqual({
      error: 'color must be one of: none, red, yellow, green, blue, purple',
    });
  });

  it('updates color via PUT and persists it', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b' })
      .expect(201);
    const updated = await request(app)
      .put(`/api/notes/${created.body.id}`)
      .send({ color: 'blue' })
      .expect(200);
    expect(updated.body.color).toBe('blue');
  });

  it('rejects PUT with an invalid color value (400)', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b' })
      .expect(201);
    const res = await request(app)
      .put(`/api/notes/${created.body.id}`)
      .send({ color: 'orange' })
      .expect(400);
    expect(res.body).toEqual({
      error: 'color must be one of: none, red, yellow, green, blue, purple',
    });
  });

  it('pinned note appears first in list response', async () => {
    const app = createApp();
    await request(app).post('/api/notes').send({ title: 'first', body: 'b' }).expect(201);
    const b = await request(app)
      .post('/api/notes')
      .send({ title: 'second', body: 'b' })
      .expect(201);

    // Pin the second (newer) note
    await request(app).patch(`/api/notes/${b.body.id}/pin`).expect(200);

    const list = await request(app).get('/api/notes').expect(200);
    const titles = (list.body as Array<{ title: string }>).map((n) => n.title);
    expect(titles[0]).toBe('second'); // pinned sorts first
    expect(titles[1]).toBe('first');
  });

  it('GET /api/notes?sort=newest returns most-recently-created first', async () => {
    const app = createApp();
    await request(app).post('/api/notes').send({ title: 'first', body: 'b' }).expect(201);
    await request(app).post('/api/notes').send({ title: 'second', body: 'b' }).expect(201);
    await request(app).post('/api/notes').send({ title: 'third', body: 'b' }).expect(201);

    const res = await request(app).get('/api/notes?sort=newest').expect(200);
    const titles = (res.body as Array<{ title: string }>).map((n) => n.title);
    expect(titles).toEqual(['third', 'second', 'first']);
  });

  it('GET /api/notes?sort=oldest returns earliest-created first', async () => {
    const app = createApp();
    await request(app).post('/api/notes').send({ title: 'first', body: 'b' }).expect(201);
    await request(app).post('/api/notes').send({ title: 'second', body: 'b' }).expect(201);
    await request(app).post('/api/notes').send({ title: 'third', body: 'b' }).expect(201);

    const res = await request(app).get('/api/notes?sort=oldest').expect(200);
    const titles = (res.body as Array<{ title: string }>).map((n) => n.title);
    expect(titles).toEqual(['first', 'second', 'third']);
  });

  it('GET /api/notes?sort=title returns notes in A→Z order', async () => {
    const app = createApp();
    await request(app).post('/api/notes').send({ title: 'Banana', body: 'b' }).expect(201);
    await request(app).post('/api/notes').send({ title: 'Apple', body: 'b' }).expect(201);
    await request(app).post('/api/notes').send({ title: 'Cherry', body: 'b' }).expect(201);

    const res = await request(app).get('/api/notes?sort=title').expect(200);
    const titles = (res.body as Array<{ title: string }>).map((n) => n.title);
    expect(titles).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  it('GET /api/notes with invalid sort value returns 400 with descriptive error', async () => {
    const app = createApp();
    const res = await request(app).get('/api/notes?sort=random').expect(400);
    expect(res.body).toEqual({ error: 'sort must be one of: newest, oldest, title' });
  });

  it('GET /api/notes with array sort param returns 400', async () => {
    const app = createApp();
    // ?sort[]=newest is an array — should be rejected
    const res = await request(app).get('/api/notes?sort[]=newest').expect(400);
    expect(res.body).toEqual({ error: 'sort must be one of: newest, oldest, title' });
  });

  it('sort and page params work together (pagination consistent with sort order)', async () => {
    const app = createApp();
    await request(app).post('/api/notes').send({ title: 'Apple', body: 'b' }).expect(201);
    await request(app).post('/api/notes').send({ title: 'Banana', body: 'b' }).expect(201);
    await request(app).post('/api/notes').send({ title: 'Cherry', body: 'b' }).expect(201);

    // title sort, pageSize=2: page 1 = Apple+Banana, page 2 = Cherry
    const page1 = await request(app).get('/api/notes?sort=title&page=1&pageSize=2').expect(200);
    expect((page1.body as Array<{ title: string }>).map((n) => n.title)).toEqual([
      'Apple',
      'Banana',
    ]);
    const page2 = await request(app).get('/api/notes?sort=title&page=2&pageSize=2').expect(200);
    expect((page2.body as Array<{ title: string }>).map((n) => n.title)).toEqual(['Cherry']);
  });

  it('pinned notes stay first regardless of sort order', async () => {
    const app = createApp();
    await request(app).post('/api/notes').send({ title: 'Zebra', body: 'b' }).expect(201);
    const apple = await request(app)
      .post('/api/notes')
      .send({ title: 'Apple', body: 'b' })
      .expect(201);
    // Pin 'Apple' — it should appear first even though 'Zebra' < 'Apple' would
    // normally be wrong, but here 'Zebra' sorts before 'Apple' alphabetically;
    // pin makes Apple win regardless.
    await request(app).patch(`/api/notes/${apple.body.id}/pin`).expect(200);

    const res = await request(app).get('/api/notes?sort=title').expect(200);
    const titles = (res.body as Array<{ title: string }>).map((n) => n.title);
    expect(titles[0]).toBe('Apple'); // pinned → always first
  });
});

describe('PATCH /api/notes/:id/archive', () => {
  it('creates a note with archived=false by default', async () => {
    const app = createApp();
    const res = await request(app).post('/api/notes').send({ title: 't', body: 'b' }).expect(201);
    expect(res.body.archived).toBe(false);
  });

  it('toggles archived true then false', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b' })
      .expect(201);

    const archived = await request(app).patch(`/api/notes/${created.body.id}/archive`).expect(200);
    expect(archived.body.archived).toBe(true);

    const unarchived = await request(app)
      .patch(`/api/notes/${created.body.id}/archive`)
      .expect(200);
    expect(unarchived.body.archived).toBe(false);
  });

  it('returns 404 for unknown id', async () => {
    const app = createApp();
    const res = await request(app).patch('/api/notes/nope/archive').expect(404);
    expect(res.body).toEqual({ error: 'not found' });
  });

  it('archived note disappears from default GET /api/notes', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 'archive me', body: 'b' })
      .expect(201);

    await request(app).patch(`/api/notes/${created.body.id}/archive`).expect(200);

    const list = await request(app).get('/api/notes').expect(200);
    const titles = (list.body as Array<{ title: string }>).map((n) => n.title);
    expect(titles).not.toContain('archive me');
    expect(list.headers['x-total-count']).toBe('0');
  });

  it('archived note appears in GET /api/notes?archived=true', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 'archived note', body: 'b' })
      .expect(201);

    await request(app).patch(`/api/notes/${created.body.id}/archive`).expect(200);

    const list = await request(app).get('/api/notes?archived=true').expect(200);
    const titles = (list.body as Array<{ title: string }>).map((n) => n.title);
    expect(titles).toContain('archived note');
    expect(list.headers['x-total-count']).toBe('1');
  });

  it('rejects invalid archived param', async () => {
    const app = createApp();
    const res = await request(app).get('/api/notes?archived=maybe').expect(400);
    expect(res.body).toEqual({ error: 'archived must be "true" or "false"' });
  });

  it('archived notes excluded from search results in default view', async () => {
    const app = createApp();
    await request(app).post('/api/notes').send({ title: 'findable active', body: 'b' }).expect(201);
    const archived = await request(app)
      .post('/api/notes')
      .send({ title: 'findable archived', body: 'b' })
      .expect(201);

    await request(app).patch(`/api/notes/${archived.body.id}/archive`).expect(200);

    const res = await request(app).get('/api/notes?q=findable').expect(200);
    expect(res.headers['x-total-count']).toBe('1');
    expect((res.body as Array<{ title: string }>)[0].title).toBe('findable active');
  });

  it('pagination still correct with archived notes excluded', async () => {
    const app = createApp();
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/notes')
        .send({ title: `note ${i}`, body: 'b' })
        .expect(201);
    }
    const archived = await request(app)
      .post('/api/notes')
      .send({ title: 'archived', body: 'b' })
      .expect(201);
    await request(app).patch(`/api/notes/${archived.body.id}/archive`).expect(200);

    const res = await request(app).get('/api/notes?page=1&pageSize=2').expect(200);
    expect(res.headers['x-total-count']).toBe('3');
    expect(res.body).toHaveLength(2);
  });
});

describe('POST /api/notes/:id/duplicate', () => {
  it('returns 404 for an unknown source note id', async () => {
    const app = createApp();
    const res = await request(app).post('/api/notes/nope/duplicate').expect(404);
    expect(res.body).toEqual({ error: 'not found' });
  });

  it('creates a new note with a distinct id, prefixed title, same body and tags', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 'Original', body: 'some body', tags: ['tag1', 'tag2'] })
      .expect(201);

    const res = await request(app).post(`/api/notes/${created.body.id}/duplicate`).expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.id).not.toBe(created.body.id);
    expect(res.body.title).toBe('Copy of Original');
    expect(res.body.body).toBe('some body');
    expect(res.body.tags).toEqual(['tag1', 'tag2']);
  });

  it('duplicate is not pinned even when source is pinned', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 'Pinned note', body: 'b' })
      .expect(201);
    await request(app).patch(`/api/notes/${created.body.id}/pin`).expect(200);

    const res = await request(app).post(`/api/notes/${created.body.id}/duplicate`).expect(201);
    expect(res.body.pinned).toBe(false);
  });

  it('duplicate appears in the notes list', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 'List note', body: 'b' })
      .expect(201);

    await request(app).post(`/api/notes/${created.body.id}/duplicate`).expect(201);

    const list = await request(app).get('/api/notes').expect(200);
    const titles = (list.body as Array<{ title: string }>).map((n) => n.title);
    expect(titles).toContain('List note');
    expect(titles).toContain('Copy of List note');
  });

  it('attachments are NOT copied to the duplicate', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 'With attach', body: 'b' })
      .expect(201);
    // Add an attachment to the original
    await request(app)
      .post(`/api/notes/${created.body.id}/attachments`)
      .attach('file', Buffer.from('hello'), { filename: 'hello.txt', contentType: 'text/plain' })
      .expect(201);

    const dup = await request(app).post(`/api/notes/${created.body.id}/duplicate`).expect(201);

    const atts = await request(app).get(`/api/notes/${dup.body.id}/attachments`).expect(200);
    expect(atts.body).toHaveLength(0);
  });
});

describe('POST /api/test/reset — guarded reset endpoint', () => {
  let savedEnv: string | undefined;

  afterEach(() => {
    // Restore the env variable to what it was before each test
    if (savedEnv === undefined) {
      delete process.env.ENABLE_TEST_RESET;
    } else {
      process.env.ENABLE_TEST_RESET = savedEnv;
    }
  });

  it('returns 204 and clears notes when ENABLE_TEST_RESET=1', async () => {
    savedEnv = process.env.ENABLE_TEST_RESET;
    process.env.ENABLE_TEST_RESET = '1';

    const store = new NoteStore();
    const app = createApp(store);

    // Seed a note
    await request(app).post('/api/notes').send({ title: 't', body: 'b' }).expect(201);

    // Reset
    await request(app).post('/api/test/reset').expect(204);

    // List should be empty
    const res = await request(app).get('/api/notes').expect(200);
    expect(res.body).toHaveLength(0);
    expect(res.headers['x-total-count']).toBe('0');
  });

  it('returns 404 when ENABLE_TEST_RESET is not set', async () => {
    savedEnv = process.env.ENABLE_TEST_RESET;
    delete process.env.ENABLE_TEST_RESET;

    const app = createApp();
    await request(app).post('/api/test/reset').expect(404);
  });
});

describe('POST /api/test/reset — guarded reset endpoint', () => {
  let savedEnv: string | undefined;

  afterEach(() => {
    // Restore the env variable to what it was before each test
    if (savedEnv === undefined) {
      delete process.env.ENABLE_TEST_RESET;
    } else {
      process.env.ENABLE_TEST_RESET = savedEnv;
    }
  });

  it('returns 204 and clears notes when ENABLE_TEST_RESET=1', async () => {
    savedEnv = process.env.ENABLE_TEST_RESET;
    process.env.ENABLE_TEST_RESET = '1';

    const store = new NoteStore();
    const app = createApp(store);

    // Seed a note
    await request(app).post('/api/notes').send({ title: 't', body: 'b' }).expect(201);

    // Reset
    await request(app).post('/api/test/reset').expect(204);

    // List should be empty
    const res = await request(app).get('/api/notes').expect(200);
    expect(res.body).toHaveLength(0);
    expect(res.headers['x-total-count']).toBe('0');
  });

  it('returns 404 when ENABLE_TEST_RESET is not set', async () => {
    savedEnv = process.env.ENABLE_TEST_RESET;
    delete process.env.ENABLE_TEST_RESET;

    const app = createApp();
    await request(app).post('/api/test/reset').expect(404);
  });
});
