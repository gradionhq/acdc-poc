import type { NoteColor } from './api';

/**
 * A built-in note template. Choosing one seeds the new-note composer's
 * title / body / tags / color fields. Templates are static, client-side
 * presets — no server involvement.
 */
export interface NoteTemplate {
  /** Stable identifier, also used as the React key and for test selection. */
  id: string;
  /** Human-readable name shown on the template button. */
  label: string;
  /** Seed value for the composer Title field. */
  title: string;
  /** Seed value for the composer Body field (Markdown). */
  body: string;
  /** Seed tags; rendered into the comma-separated Tags input. */
  tags: string[];
  /** Seed color swatch. */
  color: NoteColor;
}

/**
 * The fields a template seeds into the composer. `tags` is pre-joined into the
 * comma-separated string the Tags input expects.
 */
export interface TemplateSeed {
  title: string;
  body: string;
  tagsInput: string;
  color: NoteColor;
}

/** Built-in templates offered by the new-note flow. */
export const NOTE_TEMPLATES: readonly NoteTemplate[] = [
  {
    id: 'meeting',
    label: 'Meeting',
    title: 'Meeting notes',
    body: [
      '## Attendees',
      '- ',
      '',
      '## Agenda',
      '1. ',
      '',
      '## Notes',
      '- ',
      '',
      '## Action items',
      '- [ ] ',
    ].join('\n'),
    tags: ['meeting'],
    color: 'blue',
  },
  {
    id: 'todo',
    label: 'To-do',
    title: 'To-do',
    body: ['## Tasks', '- [ ] ', '- [ ] ', '- [ ] '].join('\n'),
    tags: ['todo'],
    color: 'green',
  },
  {
    id: 'journal',
    label: 'Journal',
    title: 'Journal entry',
    body: ['## Today', '', '## Highlights', '- ', '', '## Gratitude', '- '].join('\n'),
    tags: ['journal'],
    color: 'yellow',
  },
] as const;

/** Look up a template by id, or `undefined` if none matches. */
export function getTemplateById(id: string): NoteTemplate | undefined {
  return NOTE_TEMPLATES.find((t) => t.id === id);
}

/**
 * Project a template into the seed values the composer consumes. Tags are
 * joined with ', ' to match the composer's comma-separated Tags input format.
 */
export function templateSeed(template: NoteTemplate): TemplateSeed {
  return {
    title: template.title,
    body: template.body,
    tagsInput: template.tags.join(', '),
    color: template.color,
  };
}
