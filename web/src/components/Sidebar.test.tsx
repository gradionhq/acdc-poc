import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar, type AppView } from './Sidebar';

function renderSidebar(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const props = {
    view: 'all' as AppView,
    onSelectView: vi.fn(),
    ...overrides,
  };
  render(<Sidebar {...props} />);
  return props;
}

describe('Sidebar', () => {
  it('renders the four navigation items with stable accessible names', () => {
    renderSidebar();
    expect(screen.getByRole('navigation', { name: /views/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show all notes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show archived notes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show trash/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manage tags/i })).toBeInTheDocument();
  });

  it('marks the active view with aria-current', () => {
    renderSidebar({ view: 'archived' });
    expect(screen.getByRole('button', { name: /show archived notes/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: /show all notes/i })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('calls onSelectView with the chosen view when an item is clicked', async () => {
    const { onSelectView } = renderSidebar({ view: 'all' });
    await userEvent.click(screen.getByRole('button', { name: /show trash/i }));
    expect(onSelectView).toHaveBeenCalledWith('trash');
  });

  it('still calls onSelectView when the active item is clicked', async () => {
    const { onSelectView } = renderSidebar({ view: 'tags' });
    await userEvent.click(screen.getByRole('button', { name: /manage tags/i }));
    expect(onSelectView).toHaveBeenCalledWith('tags');
  });

  it('renders a count badge for each view that supplies one', () => {
    renderSidebar({ counts: { all: 12, archived: 3, trash: 0, tags: 7 } });
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    // Zero is a meaningful count and is shown rather than hidden.
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('omits the badge for views with no supplied count', () => {
    renderSidebar({ counts: { all: 5 } });
    expect(screen.getByText('5')).toBeInTheDocument();
    // Only the one supplied count renders a badge.
    expect(screen.getByRole('button', { name: /show archived notes/i })).not.toHaveTextContent('0');
  });

  it('renders no badges when counts is omitted entirely', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: /show all notes/i })).toHaveTextContent(
      /^All notes$/,
    );
  });

  it('folds the count into the accessible name so it is announced', () => {
    renderSidebar({ counts: { all: 4 } });
    expect(screen.getByRole('button', { name: /show all notes \(4\)/i })).toBeInTheDocument();
    // Items without a count keep their stable accessible name.
    expect(screen.getByRole('button', { name: /^show trash$/i })).toBeInTheDocument();
  });

  it('abbreviates large counts in the badge', () => {
    renderSidebar({ counts: { all: 1234 } });
    expect(screen.getByText('1k+')).toBeInTheDocument();
    expect(screen.queryByText('1234')).not.toBeInTheDocument();
  });
});
