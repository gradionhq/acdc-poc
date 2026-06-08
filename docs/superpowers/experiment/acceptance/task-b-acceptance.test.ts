// docs/superpowers/experiment/acceptance/task-b-acceptance.test.ts
// Operator copies this into test/ AFTER a run to score correctness, then reverts.
// NOTE: the import path below is relative to test/ (where it is executed), NOT
// to this file's authored location.
import { describe, expect, it } from 'vitest';
import { NoteStore } from '../src/store';

describe('pagination correctness (acceptance)', () => {
  it('page 1 returns the first pageSize items in order', () => {
    const store = new NoteStore();
    const ids = Array.from({ length: 5 }, (_, i) =>
      store.create({ title: `t${i}`, body: 'b' }).id,
    );
    expect(store.list(1, 2).items.map((n) => n.id)).toEqual([ids[0], ids[1]]);
    expect(store.list(2, 2).items.map((n) => n.id)).toEqual([ids[2], ids[3]]);
    expect(store.list(3, 2).items.map((n) => n.id)).toEqual([ids[4]]);
  });
});
