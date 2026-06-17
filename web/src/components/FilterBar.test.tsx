import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from './FilterBar';
import type { SortOrder, TagMode } from '../api';

function renderFilterBar(overrides: Partial<Parameters<typeof FilterBar>[0]> = {}) {
  const props = {
    tagFilter: '',
    onTagFilterChange: vi.fn(),
    tagMode: 'or' as TagMode,
    onTagModeChange: vi.fn(),
    sort: 'newest' as SortOrder,
    onSortChange: vi.fn(),
    ...overrides,
  };
  const result = render(<FilterBar {...props} />);
  return { ...result, props };
}

describe('FilterBar', () => {
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

  it('reflects controlled value in tag filter input', () => {
    renderFilterBar({ tagFilter: 'work' });
    expect(screen.getByRole('textbox', { name: /filter by tag/i })).toHaveValue('work');
  });

  it('reflects controlled sort value in combobox', () => {
    renderFilterBar({ sort: 'title' });
    expect(screen.getByRole('combobox', { name: /sort notes/i })).toHaveValue('title');
  });

  it('does not render the tag chip row when no tags are provided', () => {
    renderFilterBar();
    expect(screen.queryByLabelText(/filter by tag chips/i)).not.toBeInTheDocument();
  });

  it('renders a clickable chip per tag in its color', () => {
    renderFilterBar({
      tags: [
        { tag: 'work', count: 2, color: 'blue' },
        { tag: 'home', count: 1, color: null },
      ],
    });
    const workChip = screen.getByRole('button', { name: /filter by tag work/i });
    expect(workChip).toBeInTheDocument();
    expect(workChip.querySelector('[data-tag-color="blue"]')).not.toBeNull();
    const homeChip = screen.getByRole('button', { name: /filter by tag home/i });
    expect(homeChip.querySelector('[data-tag-color="none"]')).not.toBeNull();
  });

  it('clicking a tag chip sets that tag as the filter', async () => {
    const onTagFilterChange = vi.fn();
    renderFilterBar({ tags: [{ tag: 'work', count: 2, color: 'blue' }], onTagFilterChange });
    await userEvent.click(screen.getByRole('button', { name: /filter by tag work/i }));
    expect(onTagFilterChange).toHaveBeenCalledWith('work');
  });

  it('clicking the active tag chip clears the filter', async () => {
    const onTagFilterChange = vi.fn();
    renderFilterBar({
      tags: [{ tag: 'work', count: 2, color: 'blue' }],
      tagFilter: 'work',
      onTagFilterChange,
    });
    const chip = screen.getByRole('button', { name: /filter by tag work/i });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(chip);
    expect(onTagFilterChange).toHaveBeenCalledWith('');
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
