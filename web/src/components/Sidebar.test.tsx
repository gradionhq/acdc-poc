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
});
