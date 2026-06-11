// test/attachments.test.ts
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { NoteStore } from '../src/store';

/** Create a note and return its id. */
async function seedNote(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await request(app)
    .post('/api/notes')
    .send({ title: 'attachment test note', body: 'body' })
    .expect(201);
  return (res.body as { id: string }).id;
}

describe('attachment upload', () => {
  it('uploads a file and returns 201 with metadata', async () => {
    const app = createApp();
    const id = await seedNote(app);
    const res = await request(app)
      .post(`/api/notes/${id}/attachments`)
      .attach('file', Buffer.from('hello'), { filename: 'hello.txt', contentType: 'text/plain' })
      .expect(201);
    expect(res.body).toMatchObject({
      filename: 'hello.txt',
      contentType: 'text/plain',
      size: 5,
    });
  });

  it('returns 404 when note does not exist', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/notes/no-such-note/attachments')
      .attach('file', Buffer.from('x'), { filename: 'x.txt', contentType: 'text/plain' })
      .expect(404);
    expect(res.body).toEqual({ error: 'not found' });
  });

  it('returns 400 when no file is sent', async () => {
    const app = createApp();
    const id = await seedNote(app);
    const res = await request(app)
      .post(`/api/notes/${id}/attachments`)
      .set('content-type', 'multipart/form-data')
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 413 when file size exceeds limit', async () => {
    const app = createApp();
    const id = await seedNote(app);
    const bigBuffer = Buffer.alloc(6 * 1024 * 1024, 'x');
    const res = await request(app)
      .post(`/api/notes/${id}/attachments`)
      .attach('file', bigBuffer, { filename: 'big.txt', contentType: 'text/plain' })
      .expect(413);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for a disallowed content type', async () => {
    const app = createApp();
    const id = await seedNote(app);
    const res = await request(app)
      .post(`/api/notes/${id}/attachments`)
      .attach('file', Buffer.from('<exe>'), {
        filename: 'bad.exe',
        contentType: 'application/octet-stream',
      })
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('sanitises path traversal attempts in filename', async () => {
    const app = createApp();
    const id = await seedNote(app);
    const res = await request(app)
      .post(`/api/notes/${id}/attachments`)
      .attach('file', Buffer.from('data'), {
        filename: '../../etc/passwd',
        contentType: 'text/plain',
      })
      .expect(201);
    // The stored filename must not contain path separators
    const meta = res.body as { filename: string };
    expect(meta.filename).not.toContain('/');
    expect(meta.filename).not.toContain('..');
  });
});

describe('attachment download', () => {
  it('downloads the uploaded file with security headers', async () => {
    const app = createApp();
    const id = await seedNote(app);
    await request(app)
      .post(`/api/notes/${id}/attachments`)
      .attach('file', Buffer.from('world'), { filename: 'world.txt', contentType: 'text/plain' })
      .expect(201);

    const dl = await request(app).get(`/api/notes/${id}/attachments/world.txt`).expect(200);

    expect(dl.headers['content-disposition']).toMatch(/attachment/);
    expect(dl.headers['x-content-type-options']).toBe('nosniff');
    expect(dl.text).toBe('world');
  });

  it('emits RFC 5987 filename* for unicode filenames', async () => {
    const app = createApp();
    const id = await seedNote(app);
    // Upload with a unicode filename (café.txt)
    await request(app)
      .post(`/api/notes/${id}/attachments`)
      .attach('file', Buffer.from('data'), {
        filename: 'café.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    // Retrieve the stored name from the list (sanitised, so ASCII chars kept)
    const list = await request(app).get(`/api/notes/${id}/attachments`).expect(200);
    const storedName = (list.body as Array<{ filename: string }>)[0].filename;

    const dl = await request(app)
      .get(`/api/notes/${id}/attachments/${encodeURIComponent(storedName)}`)
      .expect(200);

    const cd = dl.headers['content-disposition'] as string;
    expect(cd).toMatch(/attachment/);
    // Must carry the filename* UTF-8 form, not a bare unencoded value
    expect(cd).toMatch(/filename\*=UTF-8''/);
    // Must not contain a raw double-quote (would break the quoted-string form)
    expect(cd).not.toMatch(/filename="[^"]*"[^;]/);
  });

  it('Content-Disposition is well-formed for filenames containing special chars', async () => {
    const app = createApp();
    const id = await seedNote(app);
    // Use a filename with a space and exclamation mark (safe for multipart)
    await request(app)
      .post(`/api/notes/${id}/attachments`)
      .attach('file', Buffer.from('x'), {
        filename: 'my file!.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    const list = await request(app).get(`/api/notes/${id}/attachments`).expect(200);
    const storedName = (list.body as Array<{ filename: string }>)[0].filename;

    const dl = await request(app)
      .get(`/api/notes/${id}/attachments/${encodeURIComponent(storedName)}`)
      .expect(200);

    const cd = dl.headers['content-disposition'] as string;
    // Must be well-formed: quoted ASCII fallback + UTF-8 encoded form
    expect(cd).toMatch(/^attachment; filename="[^"]*"; filename\*=UTF-8''/);
    // Must not contain a raw double-quote that would break header parsing
    const filenameValue = cd.match(/filename="([^"]*)"/)?.[1] ?? '';
    expect(filenameValue).not.toContain('"');
  });

  it('returns 404 for a missing attachment', async () => {
    const app = createApp();
    const id = await seedNote(app);
    await request(app).get(`/api/notes/${id}/attachments/nope.txt`).expect(404);
  });

  it('returns 404 for attachment on unknown note', async () => {
    const app = createApp();
    await request(app).get('/api/notes/no-such-note/attachments/file.txt').expect(404);
  });
});

describe('attachment collision / overwrite protection', () => {
  it('disambiguates duplicate filenames instead of silently overwriting', async () => {
    const app = createApp();
    const id = await seedNote(app);

    const r1 = await request(app)
      .post(`/api/notes/${id}/attachments`)
      .attach('file', Buffer.from('first'), { filename: 'dup.txt', contentType: 'text/plain' })
      .expect(201);
    const r2 = await request(app)
      .post(`/api/notes/${id}/attachments`)
      .attach('file', Buffer.from('second'), { filename: 'dup.txt', contentType: 'text/plain' })
      .expect(201);

    // The second upload must get a different stored name
    expect((r1.body as { filename: string }).filename).not.toEqual(
      (r2.body as { filename: string }).filename,
    );

    // Both files must still be retrievable
    const list = await request(app).get(`/api/notes/${id}/attachments`).expect(200);
    expect((list.body as unknown[]).length).toBe(2);
  });

  it('sanitised collision also disambiguates (a/b.txt vs a_b.txt)', async () => {
    const app = createApp();
    const id = await seedNote(app);

    // Both names sanitise to the same basename (a_b.txt)
    const r1 = await request(app)
      .post(`/api/notes/${id}/attachments`)
      .attach('file', Buffer.from('one'), { filename: 'a/b.txt', contentType: 'text/plain' })
      .expect(201);
    const r2 = await request(app)
      .post(`/api/notes/${id}/attachments`)
      .attach('file', Buffer.from('two'), { filename: 'a_b.txt', contentType: 'text/plain' })
      .expect(201);

    expect((r1.body as { filename: string }).filename).not.toEqual(
      (r2.body as { filename: string }).filename,
    );
  });
});

describe('per-note attachment cap', () => {
  it('returns 413 once the cap is reached', async () => {
    const app = createApp();
    const id = await seedNote(app);
    const cap = NoteStore.MAX_ATTACHMENTS_PER_NOTE;

    // Upload up to the cap
    for (let i = 0; i < cap; i++) {
      await request(app)
        .post(`/api/notes/${id}/attachments`)
        .attach('file', Buffer.from(`data${i}`), {
          filename: `file${i}.txt`,
          contentType: 'text/plain',
        })
        .expect(201);
    }

    // One more must be rejected
    const res = await request(app)
      .post(`/api/notes/${id}/attachments`)
      .attach('file', Buffer.from('overflow'), {
        filename: 'overflow.txt',
        contentType: 'text/plain',
      })
      .expect(413);
    expect(res.body).toHaveProperty('error');
  });
});

describe('attachment list', () => {
  it('returns empty array before any uploads', async () => {
    const app = createApp();
    const id = await seedNote(app);
    const res = await request(app).get(`/api/notes/${id}/attachments`).expect(200);
    expect(res.body).toEqual([]);
  });

  it('lists metadata after upload', async () => {
    const app = createApp();
    const id = await seedNote(app);
    await request(app)
      .post(`/api/notes/${id}/attachments`)
      .attach('file', Buffer.from('abc'), { filename: 'abc.txt', contentType: 'text/plain' })
      .expect(201);

    const res = await request(app).get(`/api/notes/${id}/attachments`).expect(200);
    expect(res.body).toHaveLength(1);
    expect((res.body as Array<{ filename: string }>)[0].filename).toBe('abc.txt');
  });

  it('returns 404 when listing attachments for unknown note', async () => {
    const app = createApp();
    const res = await request(app).get('/api/notes/no-such/attachments').expect(404);
    expect(res.body).toEqual({ error: 'not found' });
  });
});

describe('attachment delete', () => {
  it('deletes an attachment and returns 204', async () => {
    const app = createApp();
    const id = await seedNote(app);
    await request(app)
      .post(`/api/notes/${id}/attachments`)
      .attach('file', Buffer.from('bye'), { filename: 'bye.txt', contentType: 'text/plain' })
      .expect(201);

    await request(app).delete(`/api/notes/${id}/attachments/bye.txt`).expect(204);

    // The attachment should no longer appear in the list
    const list = await request(app).get(`/api/notes/${id}/attachments`).expect(200);
    expect(list.body).toEqual([]);
  });

  it('returns 404 when deleting a non-existent attachment', async () => {
    const app = createApp();
    const id = await seedNote(app);
    const res = await request(app).delete(`/api/notes/${id}/attachments/ghost.txt`).expect(404);
    expect(res.body).toEqual({ error: 'not found' });
  });

  it('returns 404 when deleting an attachment for an unknown note', async () => {
    const app = createApp();
    const res = await request(app)
      .delete('/api/notes/no-such-note/attachments/file.txt')
      .expect(404);
    expect(res.body).toEqual({ error: 'not found' });
  });

  it('does not affect other attachments on the same note', async () => {
    const app = createApp();
    const id = await seedNote(app);

    await request(app)
      .post(`/api/notes/${id}/attachments`)
      .attach('file', Buffer.from('keep'), { filename: 'keep.txt', contentType: 'text/plain' })
      .expect(201);
    await request(app)
      .post(`/api/notes/${id}/attachments`)
      .attach('file', Buffer.from('remove'), { filename: 'remove.txt', contentType: 'text/plain' })
      .expect(201);

    await request(app).delete(`/api/notes/${id}/attachments/remove.txt`).expect(204);

    const list = await request(app).get(`/api/notes/${id}/attachments`).expect(200);
    expect(list.body).toHaveLength(1);
    expect((list.body as Array<{ filename: string }>)[0].filename).toBe('keep.txt');
  });

  it('does not affect the note text content when deleting an attachment', async () => {
    const app = createApp();
    const id = await seedNote(app);
    await request(app)
      .post(`/api/notes/${id}/attachments`)
      .attach('file', Buffer.from('data'), { filename: 'data.txt', contentType: 'text/plain' })
      .expect(201);

    await request(app).delete(`/api/notes/${id}/attachments/data.txt`).expect(204);

    const note = await request(app).get(`/api/notes/${id}`).expect(200);
    expect((note.body as { title: string }).title).toBe('attachment test note');
    expect((note.body as { body: string }).body).toBe('body');
  });

  it('sanitises path traversal attempts in the delete filename param', async () => {
    const app = createApp();
    const id = await seedNote(app);
    // Upload as a safe name, then try to delete via a traversal path
    await request(app)
      .post(`/api/notes/${id}/attachments`)
      .attach('file', Buffer.from('x'), { filename: 'safe.txt', contentType: 'text/plain' })
      .expect(201);

    // Traversal attempt should resolve to the sanitised key or 404 — never a server error
    const res = await request(app)
      .delete(`/api/notes/${id}/attachments/../../etc/passwd`)
      .expect(404);
    expect(res.body).toEqual({ error: 'not found' });

    // The original file must still exist
    const list = await request(app).get(`/api/notes/${id}/attachments`).expect(200);
    expect(list.body).toHaveLength(1);
  });
});
