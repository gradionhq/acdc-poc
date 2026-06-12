import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { FilterBar } from './FilterBar';
import type { SortOrder, TagMode } from '../api';

function renderFilterBar(overrides: Partial<Parameters<typeof FilterBar>[0]> = {}) {
  const ref = createRef<HTMLInputElement>();
  const props = {
    searchInput: '',
    onSearchChange: vi.fn(),
    tagFilter: '',
    onTagFilterChange: vi.fn(),
    tagMode: 'or' as TagMode,
    onTagModeChange: vi.fn(),
    sort: 'newest' as SortOrder,
    onSortChange: vi.fn(),
    showArchived: false,
    onToggleArchived: vi.fn(),
    searchInputRef: ref,
    ...overrides,
  };
  const result = render(<FilterBar {...props} />);
  return { ...result, props };
}

describe('FilterBar', () => {
  it('renders a Search notes input accessible by aria-label', () => {
    renderFilterBar();
    expect(screen.getByRole('textbox', { name: /search notes/i })).toBeInTheDocument();
  });

  it('renders a Filter by tag input accessible by aria-label', () => {
    renderFilterBar();
    expect(screen.getByRole('textbox', { name: /filter by tag/i })).toBeInTheDocument();
  });

  it('renders the Sort notes combobox with correct options', () => {
    renderFilterBar();
    const select = screen.getByRole('combobox', { name: /sort notes/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /newest first/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /oldest first/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /title/i })).toBeInTheDocument();
  });

  it('renders the archive toggle button with "Show archived notes" label when not archived', () => {
    renderFilterBar({ showArchived: false });
    expect(screen.getByRole('button', { name: /show archived notes/i })).toBeInTheDocument();
  });

  it('renders the archive toggle button with "Show active notes" label when archived', () => {
    renderFilterBar({ showArchived: true });
    expect(screen.getByRole('button', { name: /show active notes/i })).toBeInTheDocument();
  });

  it('calls onSearchChange when typing in the search input', async () => {
    const onSearchChange = vi.fn();
    renderFilterBar({ onSearchChange });
    await userEvent.type(screen.getByRole('textbox', { name: /search notes/i }), 'foo');
    expect(onSearchChange).toHaveBeenCalled();
  });

  it('calls onTagFilterChange when typing in the tag filter input', async () => {
    const onTagFilterChange = vi.fn();
    renderFilterBar({ onTagFilterChange });
    await userEvent.type(screen.getByRole('textbox', { name: /filter by tag/i }), 'bar');
    expect(onTagFilterChange).toHaveBeenCalled();
  });

  it('calls onSortChange when a sort option is selected', async () => {
    const onSortChange = vi.fn();
    renderFilterBar({ onSortChange });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort notes/i }), 'oldest');
    expect(onSortChange).toHaveBeenCalledWith('oldest');
  });

  it('calls onToggleArchived when the archive toggle is clicked', async () => {
    const onToggleArchived = vi.fn();
    renderFilterBar({ onToggleArchived });
    await userEvent.click(screen.getByRole('button', { name: /show archived notes/i }));
    expect(onToggleArchived).toHaveBeenCalledTimes(1);
  });

  it('archive toggle button shows aria-pressed=true when archived view is active', () => {
    renderFilterBar({ showArchived: true });
    expect(screen.getByRole('button', { name: /show active notes/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('archive toggle button shows aria-pressed=false when active view is default', () => {
    renderFilterBar({ showArchived: false });
    expect(screen.getByRole('button', { name: /show archived notes/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('reflects controlled value in search input', () => {
    renderFilterBar({ searchInput: 'hello' });
    expect(screen.getByRole('textbox', { name: /search notes/i })).toHaveValue('hello');
  });

  it('reflects controlled value in tag filter input', () => {
    renderFilterBar({ tagFilter: 'work' });
    expect(screen.getByRole('textbox', { name: /filter by tag/i })).toHaveValue('work');
  });

  it('reflects controlled sort value in combobox', () => {
    renderFilterBar({ sort: 'title' });
    expect(screen.getByRole('combobox', { name: /sort notes/i })).toHaveValue('title');
  });

  it('renders the tag mode toggle button with "Match ANY" label when tagMode is or', () => {
    renderFilterBar({ tagMode: 'or' });
    expect(screen.getByRole('button', { name: /match any/i })).toBeInTheDocument();
  });

  it('renders the tag mode toggle button with "Match ALL" label when tagMode is and', () => {
    renderFilterBar({ tagMode: 'and' });
    expect(screen.getByRole('button', { name: /match all/i })).toBeInTheDocument();
  });

  it('calls onTagModeChange with "and" when toggle is clicked and current mode is or', async () => {
    const onTagModeChange = vi.fn();
    renderFilterBar({ tagMode: 'or', onTagModeChange });
    await userEvent.click(screen.getByRole('button', { name: /match any/i }));
    expect(onTagModeChange).toHaveBeenCalledWith('and');
  });

  it('calls onTagModeChange with "or" when toggle is clicked and current mode is and', async () => {
    const onTagModeChange = vi.fn();
    renderFilterBar({ tagMode: 'and', onTagModeChange });
    await userEvent.click(screen.getByRole('button', { name: /match all/i }));
    expect(onTagModeChange).toHaveBeenCalledWith('or');
  });

  it('tag mode toggle has aria-pressed=true when tagMode is and', () => {
    renderFilterBar({ tagMode: 'and' });
    expect(screen.getByRole('button', { name: /match all/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('tag mode toggle has aria-pressed=false when tagMode is or', () => {
    renderFilterBar({ tagMode: 'or' });
    expect(screen.getByRole('button', { name: /match any/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
