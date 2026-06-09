// test/attachments.test.ts
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

async function createNote(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await request(app).post('/notes').send({ title: 't', body: 'b' }).expect(201);
  return res.body.id as string;
}

describe('note attachments API', () => {
  it('uploads a file and returns 201 with its metadata', async () => {
    const app = createApp();
    const id = await createNote(app);

    const res = await request(app)
      .post(`/notes/${id}/attachments`)
      .attach('file', Buffer.from('hello world'), {
        filename: 'greeting.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    expect(res.body).toEqual({
      filename: 'greeting.txt',
      size: 11,
      contentType: 'text/plain',
    });
  });

  it('downloads the stored bytes with the original content type', async () => {
    const app = createApp();
    const id = await createNote(app);
    await request(app)
      .post(`/notes/${id}/attachments`)
      .attach('file', Buffer.from('hello world'), {
        filename: 'greeting.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    const res = await request(app).get(`/notes/${id}/attachments/greeting.txt`).expect(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.headers['content-length']).toBe('11');
    expect(res.text).toBe('hello world');
  });

  it('records attachment metadata on the note', async () => {
    const app = createApp();
    const id = await createNote(app);
    await request(app)
      .post(`/notes/${id}/attachments`)
      .attach('file', Buffer.from('data'), { filename: 'a.bin', contentType: 'application/octet-stream' })
      .expect(201);

    const note = await request(app).get(`/notes/${id}`).expect(200);
    expect(note.body.attachments).toEqual([
      { filename: 'a.bin', size: 4, contentType: 'application/octet-stream' },
    ]);
  });

  it('returns 404 when uploading to a missing note', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/notes/nope/attachments')
      .attach('file', Buffer.from('x'), { filename: 'x.txt', contentType: 'text/plain' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when no file field is provided', async () => {
    const app = createApp();
    const id = await createNote(app);
    const res = await request(app).post(`/notes/${id}/attachments`);
    expect(res.status).toBe(400);
  });

  it('rejects a malformed upload with 400', async () => {
    const app = createApp();
    const id = await createNote(app);
    // multer is configured for a single `file` field; any other field is rejected.
    const res = await request(app)
      .post(`/notes/${id}/attachments`)
      .attach('wrong', Buffer.from('x'), { filename: 'x.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when downloading from a missing note', async () => {
    const app = createApp();
    const res = await request(app).get('/notes/nope/attachments/x.txt');
    expect(res.status).toBe(404);
  });

  it('returns 404 for an unknown attachment name', async () => {
    const app = createApp();
    const id = await createNote(app);
    const res = await request(app).get(`/notes/${id}/attachments/missing.txt`);
    expect(res.status).toBe(404);
  });
});
