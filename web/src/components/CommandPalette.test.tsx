import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette, type Command } from './CommandPalette';

function makeCommands(): { commands: Command[]; runs: Record<string, ReturnType<typeof vi.fn>> } {
  const runs = {
    newNote: vi.fn(),
    theme: vi.fn(),
    archived: vi.fn(),
    note: vi.fn(),
  };
  const commands: Command[] = [
    { id: 'new-note', title: 'New note', group: 'Action', run: runs.newNote },
    { id: 'theme', title: 'Switch to dark theme', group: 'Action', run: runs.theme },
    { id: 'archived', title: 'Go to: Archived', group: 'View', run: runs.archived },
    { id: 'note-1', title: 'Grocery list', group: 'Note', run: runs.note },
  ];
  return { commands, runs };
}

describe('CommandPalette', () => {
  it('renders as a labelled modal dialog with the search input focused', () => {
    const { commands } = makeCommands();
    render(<CommandPalette commands={commands} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /command palette/i })).toBeInTheDocument();
    const input = screen.getByRole('combobox', { name: /command palette search/i });
    expect(document.activeElement).toBe(input);
  });

  it('lists all commands initially with their group hints', () => {
    const { commands } = makeCommands();
    render(<CommandPalette commands={commands} onClose={vi.fn()} />);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(commands.length);
    expect(within(options[0]).getByText('New note')).toBeInTheDocument();
    expect(within(options[3]).getByText('Note')).toBeInTheDocument();
  });

  it('fuzzy-filters the list as the user types (including note titles)', async () => {
    const { commands } = makeCommands();
    render(<CommandPalette commands={commands} onClose={vi.fn()} />);
    await userEvent.keyboard('groc');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(within(options[0]).getByText('Grocery list')).toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', async () => {
    const { commands } = makeCommands();
    render(<CommandPalette commands={commands} onClose={vi.fn()} />);
    await userEvent.keyboard('zzzzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText(/no matching commands/i)).toBeInTheDocument();
  });

  it('runs the first command and closes on Enter', async () => {
    const { commands, runs } = makeCommands();
    const onClose = vi.fn();
    render(<CommandPalette commands={commands} onClose={onClose} />);
    await userEvent.keyboard('{Enter}');
    expect(runs.newNote).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('moves the active row with ArrowDown and runs it on Enter', async () => {
    const { commands, runs } = makeCommands();
    render(<CommandPalette commands={commands} onClose={vi.fn()} />);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(runs.theme).toHaveBeenCalledOnce();
    expect(runs.newNote).not.toHaveBeenCalled();
  });

  it('wraps with ArrowUp from the first row to the last', async () => {
    const { commands, runs } = makeCommands();
    render(<CommandPalette commands={commands} onClose={vi.fn()} />);
    await userEvent.keyboard('{ArrowUp}{Enter}');
    expect(runs.note).toHaveBeenCalledOnce();
  });

  it('reflects the active option via aria-activedescendant', async () => {
    const { commands } = makeCommands();
    render(<CommandPalette commands={commands} onClose={vi.fn()} />);
    const input = screen.getByRole('combobox', { name: /command palette search/i });
    expect(input).toHaveAttribute('aria-activedescendant', 'command-option-new-note');
    await userEvent.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', 'command-option-theme');
  });

  it('runs a command and closes when its row is clicked', async () => {
    const { commands, runs } = makeCommands();
    const onClose = vi.fn();
    render(<CommandPalette commands={commands} onClose={onClose} />);
    await userEvent.click(screen.getByText('Go to: Archived'));
    expect(runs.archived).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on Escape via the Modal primitive', async () => {
    const { commands } = makeCommands();
    const onClose = vi.fn();
    render(<CommandPalette commands={commands} onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does nothing on Enter when there are no matches', async () => {
    const { commands, runs } = makeCommands();
    const onClose = vi.fn();
    render(<CommandPalette commands={commands} onClose={onClose} />);
    await userEvent.keyboard('zzzzz{Enter}');
    expect(onClose).not.toHaveBeenCalled();
    Object.values(runs).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });
});
