// test/import.test.ts
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

interface NoteResponse {
  id: string;
  title: string;
  body: string;
  tags: string[];
}

describe('POST /api/notes/import', () => {
  it('imports a markdown file, using the first heading as the title', async () => {
    const app = createApp();
    const md = '# My Title\n\nFirst paragraph.\n\nSecond paragraph.';
    const res = await request(app)
      .post('/api/notes/import')
      .attach('file', Buffer.from(md), { filename: 'note.md', contentType: 'text/markdown' })
      .expect(201);
    const body = res.body as NoteResponse;
    expect(body.title).toBe('My Title');
    expect(body.body).toBe('First paragraph.\n\nSecond paragraph.');
    expect(body.tags).toEqual([]);
    expect(typeof body.id).toBe('string');
  });

  it('strips closing # markers and surrounding whitespace from the heading', async () => {
    const app = createApp();
    const md = '##   Spaced Heading   ##\nbody';
    const res = await request(app)
      .post('/api/notes/import')
      .attach('file', Buffer.from(md), { filename: 'note.md', contentType: 'text/x-markdown' })
      .expect(201);
    expect((res.body as NoteResponse).title).toBe('Spaced Heading');
  });

  it('skips leading blank lines before the heading', async () => {
    const app = createApp();
    const md = '\n\n\n# Late Heading\n\ncontent';
    const res = await request(app)
      .post('/api/notes/import')
      .attach('file', Buffer.from(md), { filename: 'note.md', contentType: 'text/markdown' })
      .expect(201);
    expect((res.body as NoteResponse).title).toBe('Late Heading');
    expect((res.body as NoteResponse).body).toBe('content');
  });

  it('falls back to "Untitled" when there is no leading heading', async () => {
    const app = createApp();
    const md = 'just some body text\nwith no heading';
    const res = await request(app)
      .post('/api/notes/import')
      .attach('file', Buffer.from(md), { filename: 'note.md', contentType: 'text/markdown' })
      .expect(201);
    const body = res.body as NoteResponse;
    expect(body.title).toBe('Untitled');
    expect(body.body).toBe('just some body text\nwith no heading');
  });

  it('strips a UTF-8 BOM and normalises CRLF line endings', async () => {
    const app = createApp();
    const md = '﻿# Heading\r\n\r\nbody line';
    const res = await request(app)
      .post('/api/notes/import')
      .attach('file', Buffer.from(md), { filename: 'note.markdown', contentType: 'text/markdown' })
      .expect(201);
    const body = res.body as NoteResponse;
    expect(body.title).toBe('Heading');
    expect(body.body).toBe('body line');
  });

  it('accepts a .markdown extension', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/notes/import')
      .attach('file', Buffer.from('# Hi\nx'), {
        filename: 'doc.markdown',
        contentType: 'text/plain',
      })
      .expect(201);
    expect((res.body as NoteResponse).title).toBe('Hi');
  });

  it('returns 400 when no file is sent', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/notes/import')
      .set('content-type', 'multipart/form-data')
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when the file is empty', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/notes/import')
      .attach('file', Buffer.from('   \n  \n'), {
        filename: 'empty.md',
        contentType: 'text/markdown',
      })
      .expect(400);
    expect(res.body).toEqual({ error: 'file is empty' });
  });

  it('rejects a file without a markdown extension', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/notes/import')
      .attach('file', Buffer.from('# Hi'), { filename: 'note.txt', contentType: 'text/markdown' })
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects an unsupported content type', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/notes/import')
      .attach('file', Buffer.from('# Hi'), { filename: 'note.md', contentType: 'application/pdf' })
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 413 when the file exceeds the size limit', async () => {
    const app = createApp();
    const big = Buffer.alloc(1 * 1024 * 1024 + 1, 'x');
    const res = await request(app)
      .post('/api/notes/import')
      .attach('file', big, { filename: 'big.md', contentType: 'text/markdown' })
      .expect(413);
    expect(res.body).toEqual({ error: 'file too large' });
  });

  it('persists the imported note so it is retrievable', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/notes/import')
      .attach('file', Buffer.from('# Persisted\n\nhello'), {
        filename: 'p.md',
        contentType: 'text/markdown',
      })
      .expect(201);
    const id = (created.body as NoteResponse).id;
    const fetched = await request(app).get(`/api/notes/${id}`).expect(200);
    expect((fetched.body as NoteResponse).title).toBe('Persisted');
  });
});
