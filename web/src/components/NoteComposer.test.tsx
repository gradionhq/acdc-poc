import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { NoteComposer } from './NoteComposer';
import type { NoteColor } from '../api';

function renderComposer(overrides: Partial<Parameters<typeof NoteComposer>[0]> = {}) {
  const ref = createRef<HTMLInputElement>();
  const props = {
    title: '',
    onTitleChange: vi.fn(),
    body: '',
    onBodyChange: vi.fn(),
    tagsInput: '',
    onTagsInputChange: vi.fn(),
    color: 'none' as NoteColor,
    onColorChange: vi.fn(),
    onSubmit: vi.fn(),
    newNoteTitleRef: ref,
    ...overrides,
  };
  const result = render(<NoteComposer {...props} />);
  return { ...result, props };
}

describe('NoteComposer', () => {
  it('renders the "New note" heading', () => {
    renderComposer();
    expect(screen.getByRole('heading', { name: /new note/i })).toBeInTheDocument();
  });

  it('renders a Title input accessible by label', () => {
    renderComposer();
    expect(screen.getByLabelText(/^title$/i)).toBeInTheDocument();
  });

  it('renders a Body textarea accessible by label', () => {
    renderComposer();
    expect(screen.getByLabelText(/^body$/i)).toBeInTheDocument();
  });

  it('renders a Tags input with aria-label "Tags"', () => {
    renderComposer();
    expect(screen.getByRole('textbox', { name: /^tags$/i })).toBeInTheDocument();
  });

  it('renders an "Add note" submit button', () => {
    renderComposer();
    expect(screen.getByRole('button', { name: /add note/i })).toBeInTheDocument();
  });

  it('calls onTitleChange when typing in the title input', async () => {
    const onTitleChange = vi.fn();
    renderComposer({ onTitleChange });
    await userEvent.type(screen.getByLabelText(/^title$/i), 'A');
    expect(onTitleChange).toHaveBeenCalledWith('A');
  });

  it('calls onBodyChange when typing in the body textarea', async () => {
    const onBodyChange = vi.fn();
    renderComposer({ onBodyChange });
    await userEvent.type(screen.getByLabelText(/^body$/i), 'x');
    expect(onBodyChange).toHaveBeenCalledWith('x');
  });

  it('calls onTagsInputChange when typing in the tags input', async () => {
    const onTagsInputChange = vi.fn();
    renderComposer({ onTagsInputChange });
    await userEvent.type(screen.getByRole('textbox', { name: /^tags$/i }), 'foo');
    expect(onTagsInputChange).toHaveBeenCalled();
  });

  it('renders all color swatches with aria-label', () => {
    renderComposer();
    for (const c of ['none', 'red', 'yellow', 'green', 'blue', 'purple']) {
      expect(screen.getByRole('button', { name: `Color ${c}` })).toBeInTheDocument();
    }
  });

  it('marks the selected color swatch as aria-pressed=true', () => {
    renderComposer({ color: 'blue' });
    expect(screen.getByRole('button', { name: 'Color blue' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Color red' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('calls onColorChange when a swatch is clicked', async () => {
    const onColorChange = vi.fn();
    renderComposer({ onColorChange });
    await userEvent.click(screen.getByRole('button', { name: 'Color red' }));
    expect(onColorChange).toHaveBeenCalledWith('red');
  });

  it('shows word/character count as "0 words, 0 characters" initially', () => {
    renderComposer({ body: '' });
    expect(screen.getByText('0 words, 0 characters')).toBeInTheDocument();
  });

  it('shows correct word/character count for provided body text', () => {
    renderComposer({ body: 'hello world' });
    expect(screen.getByText('2 words, 11 characters')).toBeInTheDocument();
  });

  it('uses singular "word" and "character" correctly', () => {
    renderComposer({ body: 'a' });
    expect(screen.getByText('1 word, 1 character')).toBeInTheDocument();
  });

  it('calls onSubmit when the form is submitted', async () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    renderComposer({ onSubmit });
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('reflects controlled value in title input', () => {
    renderComposer({ title: 'My title' });
    expect(screen.getByLabelText(/^title$/i)).toHaveValue('My title');
  });

  it('reflects controlled value in body textarea', () => {
    renderComposer({ body: 'My body' });
    expect(screen.getByLabelText(/^body$/i)).toHaveValue('My body');
  });

  it('reflects controlled value in tags input', () => {
    renderComposer({ tagsInput: 'foo, bar' });
    expect(screen.getByRole('textbox', { name: /^tags$/i })).toHaveValue('foo, bar');
  });
});
