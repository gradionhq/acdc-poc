import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportMenu } from './ExportMenu';

describe('ExportMenu', () => {
  it('renders a labelled trigger that is collapsed by default', () => {
    render(<ExportMenu onExport={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /export notes/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens the menu showing Markdown and JSON options', async () => {
    render(<ExportMenu onExport={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /export notes/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /markdown/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /json/i })).toBeInTheDocument();
  });

  it('calls onExport with "md" and closes when Markdown is chosen', async () => {
    const onExport = vi.fn();
    render(<ExportMenu onExport={onExport} />);
    await userEvent.click(screen.getByRole('button', { name: /export notes/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /markdown/i }));
    expect(onExport).toHaveBeenCalledWith('md');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('calls onExport with "json" when JSON is chosen', async () => {
    const onExport = vi.fn();
    render(<ExportMenu onExport={onExport} />);
    await userEvent.click(screen.getByRole('button', { name: /export notes/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /json/i }));
    expect(onExport).toHaveBeenCalledWith('json');
  });

  it('closes the menu on Escape', async () => {
    render(<ExportMenu onExport={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /export notes/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes the menu when clicking outside', async () => {
    render(
      <div>
        <ExportMenu onExport={vi.fn()} />
        <button type="button">outside</button>
      </div>,
    );
    await userEvent.click(screen.getByRole('button', { name: /export notes/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('disables the trigger and does not open when disabled', async () => {
    const onExport = vi.fn();
    render(<ExportMenu disabled onExport={onExport} />);
    const trigger = screen.getByRole('button', { name: /export notes/i });
    expect(trigger).toBeDisabled();
    await userEvent.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onExport).not.toHaveBeenCalled();
  });
});
