// test/validation.test.ts — zod route-boundary validation behavior.
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('zod validation — field-level error details', () => {
  it('POST /api/notes returns details for an invalid color', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b', color: 'magenta' })
      .expect(400);
    expect(res.body.error).toBe('color must be one of: none, red, yellow, green, blue, purple');
    expect(res.body.details).toEqual([
      { field: 'color', message: 'color must be one of: none, red, yellow, green, blue, purple' },
    ]);
  });

  it('POST /api/notes reports the offending tag element path in details', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b', tags: ['ok', 42] })
      .expect(400);
    expect(res.body.error).toBe('tags must be an array of non-empty strings');
    expect(res.body.details[0].field).toBe('tags.1');
  });

  it('POST /api/notes rejects a non-string title (missing body)', async () => {
    const app = createApp();
    const res = await request(app).post('/api/notes').send({ title: 1 }).expect(400);
    expect(res.body.error).toBe('title and body must be strings');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('POST /api/notes rejects a missing body', async () => {
    const app = createApp();
    const res = await request(app).post('/api/notes').send({ title: 't' }).expect(400);
    expect(res.body.error).toBe('title and body must be strings');
  });

  it('PUT /api/notes/:id rejects a non-string title with a typed details entry', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b' })
      .expect(201);
    const res = await request(app)
      .put(`/api/notes/${created.body.id}`)
      .send({ title: 5 })
      .expect(400);
    expect(res.body.details).toContainEqual({
      field: 'title',
      message: 'title must be a string',
    });
  });

  it('PUT /api/notes/:id ignores unknown fields (legacy behavior preserved)', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'b' })
      .expect(201);
    const res = await request(app)
      .put(`/api/notes/${created.body.id}`)
      .send({ title: 'new', extraneous: true })
      .expect(200);
    expect(res.body.title).toBe('new');
  });

  it('GET /api/notes coerces a fractional page to the default rather than erroring', async () => {
    const app = createApp();
    await request(app).post('/api/notes').send({ title: 'a', body: 'b' }).expect(201);
    const res = await request(app).get('/api/notes?page=1.5').expect(200);
    expect(res.headers['x-total-count']).toBe('1');
  });

  it('GET /api/notes ignores a non-numeric pageSize', async () => {
    const app = createApp();
    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post('/api/notes')
        .send({ title: `t${i}`, body: 'b' })
        .expect(201);
    }
    // pageSize=abc → falls back to default (10), so all 3 fit on one page.
    const res = await request(app).get('/api/notes?pageSize=abc').expect(200);
    expect(res.body).toHaveLength(3);
  });
});

describe('zod validation — tags endpoints', () => {
  it('POST /api/tags/rename surfaces field details for an empty "from"', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/tags/rename')
      .send({ from: '', to: 'new' })
      .expect(400);
    expect(res.body.error).toBe('from must be a non-empty string');
    expect(res.body.details[0].field).toBe('from');
  });

  it('POST /api/tags/rename rejects a non-string "to"', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/tags/rename')
      .send({ from: 'old', to: 99 })
      .expect(400);
    expect(res.body.error).toBe('to must be a non-empty string');
  });

  it('PUT /api/tags/:name reports color details when missing', async () => {
    const app = createApp();
    const res = await request(app).put('/api/tags/work').send({}).expect(400);
    expect(res.body.details[0].field).toBe('color');
  });

  it('DELETE /api/tags/:tag rejects an over-long tag name', async () => {
    const app = createApp();
    const res = await request(app)
      .delete(`/api/tags/${'a'.repeat(101)}`)
      .expect(400);
    expect(res.body.error).toBe('tag must be at most 100 characters');
  });
});
