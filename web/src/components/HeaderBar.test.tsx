import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { HeaderBar } from './HeaderBar';

function renderHeaderBar(overrides: Partial<Parameters<typeof HeaderBar>[0]> = {}) {
  const props = {
    theme: 'light' as const,
    toggleTheme: vi.fn(),
    searchInput: '',
    onSearchChange: vi.fn(),
    searchInputRef: createRef<HTMLInputElement>(),
    onNewNote: vi.fn(),
    onExport: vi.fn(),
    exportDisabled: false,
    showHelp: false,
    onToggleHelp: vi.fn(),
    onCloseHelp: vi.fn(),
    helpToggleRef: createRef<HTMLButtonElement>(),
    helpCloseBtnRef: createRef<HTMLButtonElement>(),
    ...overrides,
  };
  render(<HeaderBar {...props} />);
  return props;
}

describe('HeaderBar', () => {
  it('renders the brand title, search box, and actions', () => {
    renderHeaderBar();
    expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /search notes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new note/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show keyboard shortcuts/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
  });

  it('reflects the controlled search value and calls onSearchChange when typing', async () => {
    const onSearchChange = vi.fn();
    renderHeaderBar({ searchInput: 'hi', onSearchChange });
    const input = screen.getByRole('textbox', { name: /search notes/i });
    expect(input).toHaveValue('hi');
    await userEvent.type(input, 'x');
    expect(onSearchChange).toHaveBeenCalled();
  });

  it('calls onNewNote when the New note action is clicked', async () => {
    const onNewNote = vi.fn();
    renderHeaderBar({ onNewNote });
    await userEvent.click(screen.getByRole('button', { name: /new note/i }));
    expect(onNewNote).toHaveBeenCalledTimes(1);
  });

  it('calls toggleTheme when the theme toggle is clicked', async () => {
    const toggleTheme = vi.fn();
    renderHeaderBar({ toggleTheme });
    await userEvent.click(screen.getByRole('button', { name: /switch to dark mode/i }));
    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });

  it('shows the light-mode label when the dark theme is active', () => {
    renderHeaderBar({ theme: 'dark' });
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument();
  });

  it('renders the keyboard shortcuts dialog only when showHelp is true', () => {
    const { rerender } = renderHelp(false);
    expect(screen.queryByRole('dialog', { name: /keyboard shortcuts/i })).not.toBeInTheDocument();
    rerender(true);
    expect(screen.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeInTheDocument();
  });
});

/** Render HeaderBar with a rerender helper that flips the showHelp flag. */
function renderHelp(initial: boolean) {
  const base = {
    theme: 'light' as const,
    toggleTheme: vi.fn(),
    searchInput: '',
    onSearchChange: vi.fn(),
    searchInputRef: createRef<HTMLInputElement>(),
    onNewNote: vi.fn(),
    onExport: vi.fn(),
    exportDisabled: false,
    onToggleHelp: vi.fn(),
    onCloseHelp: vi.fn(),
    helpToggleRef: createRef<HTMLButtonElement>(),
    helpCloseBtnRef: createRef<HTMLButtonElement>(),
  };
  const { rerender } = render(<HeaderBar {...base} showHelp={initial} />);
  return {
    rerender: (showHelp: boolean) => rerender(<HeaderBar {...base} showHelp={showHelp} />),
  };
}
