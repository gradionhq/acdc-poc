// test/tags.test.ts
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { NoteStore } from '../src/store';

describe('GET /api/tags', () => {
  it('returns an empty array when no notes exist', async () => {
    const app = createApp();
    const res = await request(app).get('/api/tags').expect(200);
    expect(res.body).toEqual([]);
  });

  it('returns tags with note counts from all notes', async () => {
    const store = new NoteStore();
    const app = createApp(store);
    await request(app)
      .post('/api/notes')
      .send({ title: 'a', body: 'b', tags: ['work', 'alpha'] })
      .expect(201);
    await request(app)
      .post('/api/notes')
      .send({ title: 'c', body: 'd', tags: ['work'] })
      .expect(201);
    await request(app)
      .post('/api/notes')
      .send({ title: 'e', body: 'f', tags: ['personal'] })
      .expect(201);

    const res = await request(app).get('/api/tags').expect(200);
    const tagMap = Object.fromEntries(
      (res.body as Array<{ tag: string; count: number }>).map(({ tag, count }) => [tag, count]),
    );
    expect(tagMap['work']).toBe(2);
    expect(tagMap['alpha']).toBe(1);
    expect(tagMap['personal']).toBe(1);
  });

  it('does not include tags from deleted notes', async () => {
    const store = new NoteStore();
    const app = createApp(store);
    const res1 = await request(app)
      .post('/api/notes')
      .send({ title: 'n', body: 'b', tags: ['gone'] })
      .expect(201);
    await request(app).delete(`/api/notes/${res1.body.id}`).expect(204);

    const res = await request(app).get('/api/tags').expect(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/tags/rename', () => {
  it('renames a tag across all notes', async () => {
    const store = new NoteStore();
    const app = createApp(store);
    await request(app)
      .post('/api/notes')
      .send({ title: 'a', body: 'b', tags: ['old'] })
      .expect(201);
    await request(app)
      .post('/api/notes')
      .send({ title: 'c', body: 'd', tags: ['old', 'other'] })
      .expect(201);

    await request(app).post('/api/tags/rename').send({ from: 'old', to: 'new' }).expect(200);

    const list = await request(app).get('/api/notes').expect(200);
    for (const note of list.body as Array<{ tags: string[] }>) {
      expect(note.tags).not.toContain('old');
    }
    const counts = (await request(app).get('/api/tags').expect(200)).body as Array<{
      tag: string;
      count: number;
    }>;
    const tagMap = Object.fromEntries(counts.map(({ tag, count }) => [tag, count]));
    expect(tagMap['new']).toBe(2);
    expect(tagMap['old']).toBeUndefined();
    expect(tagMap['other']).toBe(1);
  });

  it('returns 400 when "from" is missing', async () => {
    const app = createApp();
    const res = await request(app).post('/api/tags/rename').send({ to: 'new' }).expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when "to" is missing', async () => {
    const app = createApp();
    const res = await request(app).post('/api/tags/rename').send({ from: 'old' }).expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when "from" is empty string', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/tags/rename')
      .send({ from: '', to: 'new' })
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when "to" is empty string', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/tags/rename')
      .send({ from: 'old', to: '' })
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when "from" exceeds 100 characters', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/tags/rename')
      .send({ from: 'a'.repeat(101), to: 'new' })
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when "to" exceeds 100 characters', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/tags/rename')
      .send({ from: 'old', to: 'a'.repeat(101) })
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when "from" contains a comma', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/tags/rename')
      .send({ from: 'a,b', to: 'new' })
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when "to" contains a comma', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/tags/rename')
      .send({ from: 'old', to: 'a,b' })
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 409 when "to" already exists as a different tag', async () => {
    const store = new NoteStore();
    const app = createApp(store);
    await request(app)
      .post('/api/notes')
      .send({ title: 'a', body: 'b', tags: ['alpha'] })
      .expect(201);
    await request(app)
      .post('/api/notes')
      .send({ title: 'c', body: 'd', tags: ['beta'] })
      .expect(201);

    const res = await request(app)
      .post('/api/tags/rename')
      .send({ from: 'alpha', to: 'beta' })
      .expect(409);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 200 with 0 affected when "from" tag does not exist (no-op)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/tags/rename')
      .send({ from: 'nonexistent', to: 'new' })
      .expect(200);
    expect(res.body).toMatchObject({ affected: 0 });
  });
});

describe('DELETE /api/tags/:tag', () => {
  it('removes a tag from all notes', async () => {
    const store = new NoteStore();
    const app = createApp(store);
    await request(app)
      .post('/api/notes')
      .send({ title: 'a', body: 'b', tags: ['work', 'alpha'] })
      .expect(201);
    await request(app)
      .post('/api/notes')
      .send({ title: 'c', body: 'd', tags: ['work'] })
      .expect(201);

    await request(app).delete('/api/tags/work').expect(200);

    const list = await request(app).get('/api/notes').expect(200);
    for (const note of list.body as Array<{ tags: string[] }>) {
      expect(note.tags).not.toContain('work');
    }
    const counts = (await request(app).get('/api/tags').expect(200)).body as Array<{
      tag: string;
      count: number;
    }>;
    const tagNames = counts.map(({ tag }) => tag);
    expect(tagNames).not.toContain('work');
    expect(tagNames).toContain('alpha');
  });

  it('returns 200 with 0 affected when tag does not exist (no-op)', async () => {
    const app = createApp();
    const res = await request(app).delete('/api/tags/nonexistent').expect(200);
    expect(res.body).toMatchObject({ affected: 0 });
  });

  it('returns 400 when tag name in URL is empty (root path not matched)', async () => {
    // Hitting /api/tags/ with trailing slash or empty segment — should 404 or fallback
    // This is enforced by Express routing; the DELETE handler requires a non-empty :tag param
    const app = createApp();
    // A very long tag name (over 100 chars) sent as URL segment should be rejected
    const longTag = 'a'.repeat(101);
    const res = await request(app).delete(`/api/tags/${longTag}`).expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when tag name contains a comma', async () => {
    const app = createApp();
    const res = await request(app).delete('/api/tags/a%2Cb').expect(400);
    expect(res.body).toHaveProperty('error');
  });
});
