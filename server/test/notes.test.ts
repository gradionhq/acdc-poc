// test/notes.test.ts
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

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
    expect(res.body).toEqual({ error: 'at least one of title or body is required' });
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
});
