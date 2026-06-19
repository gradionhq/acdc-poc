import { describe, it, expect } from 'vitest';
import { NOTE_TEMPLATES, getTemplateById, templateSeed, type NoteTemplate } from './noteTemplates';
import { NOTE_COLORS } from './api';

describe('noteTemplates', () => {
  it('exposes the three built-in templates', () => {
    expect(NOTE_TEMPLATES.map((t) => t.id)).toEqual(['meeting', 'todo', 'journal']);
  });

  it('every template has a non-empty label, title and body', () => {
    for (const t of NOTE_TEMPLATES) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.body.length).toBeGreaterThan(0);
    }
  });

  it('every template uses a valid note color', () => {
    for (const t of NOTE_TEMPLATES) {
      expect(NOTE_COLORS).toContain(t.color);
    }
  });

  it('every template has at least one tag', () => {
    for (const t of NOTE_TEMPLATES) {
      expect(t.tags.length).toBeGreaterThan(0);
    }
  });

  describe('getTemplateById', () => {
    it('returns the matching template', () => {
      expect(getTemplateById('todo')?.label).toBe('To-do');
    });

    it('returns undefined for an unknown id', () => {
      expect(getTemplateById('nope')).toBeUndefined();
    });
  });

  describe('templateSeed', () => {
    it('projects a template into composer seed values', () => {
      const template: NoteTemplate = {
        id: 'x',
        label: 'X',
        title: 'T',
        body: 'B',
        tags: ['a', 'b'],
        color: 'red',
      };
      expect(templateSeed(template)).toEqual({
        title: 'T',
        body: 'B',
        tagsInput: 'a, b',
        color: 'red',
      });
    });

    it('joins tags with a comma and space', () => {
      const meeting = getTemplateById('meeting')!;
      expect(templateSeed(meeting).tagsInput).toBe('meeting');
    });

    it('produces an empty tagsInput when a template has no tags', () => {
      const template: NoteTemplate = {
        id: 'empty',
        label: 'Empty',
        title: 'T',
        body: 'B',
        tags: [],
        color: 'none',
      };
      expect(templateSeed(template).tagsInput).toBe('');
    });
  });
});
