import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell, MAIN_CONTENT_ID } from './AppShell';

describe('AppShell', () => {
  it('renders the header, sidebar, and main content regions', () => {
    render(
      <AppShell
        header={<div data-testid="hdr">header</div>}
        sidebar={<nav aria-label="Views">sidebar</nav>}
      >
        <p>main content</p>
      </AppShell>,
    );

    expect(screen.getByTestId('hdr')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /views/i })).toBeInTheDocument();
    expect(screen.getByText('main content')).toBeInTheDocument();
  });

  it('places children inside the single main landmark', () => {
    render(
      <AppShell header={<div>h</div>} sidebar={<div>s</div>}>
        <p>view body</p>
      </AppShell>,
    );

    const main = screen.getByRole('main');
    expect(main).toContainElement(screen.getByText('view body'));
    // The <main> must not carry an inline style (layout is class-driven).
    expect(main).not.toHaveAttribute('style');
  });

  it('renders a skip link as the first focusable element targeting the main landmark', () => {
    const { container } = render(
      <AppShell header={<div>h</div>} sidebar={<div>s</div>}>
        <p>view body</p>
      </AppShell>,
    );

    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    // It must point at the main landmark by id.
    expect(skipLink).toHaveAttribute('href', `#${MAIN_CONTENT_ID}`);
    expect(screen.getByRole('main')).toHaveAttribute('id', MAIN_CONTENT_ID);

    // It must be the very first focusable element in the DOM so keyboard users
    // hit it before the header or sidebar.
    const focusable = container.querySelectorAll<HTMLElement>('a[href], button, [tabindex]');
    expect(focusable[0]).toBe(skipLink);
  });

  it('makes the main landmark programmatically focusable so the skip link can move focus to it', () => {
    render(
      <AppShell header={<div>h</div>} sidebar={<div>s</div>}>
        <p>view body</p>
      </AppShell>,
    );

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('tabindex', '-1');
  });
});

describe('AppShell — responsive drawer', () => {
  function renderShell() {
    return render(
      <AppShell
        header={<div data-testid="hdr">header</div>}
        sidebar={
          <nav aria-label="Views">
            <button type="button">All notes</button>
          </nav>
        }
      >
        <p>view body</p>
      </AppShell>,
    );
  }

  it('renders a hamburger toggle that is collapsed by default', () => {
    renderShell();
    const toggle = screen.getByRole('button', { name: /open navigation menu/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls');
  });

  it('renders the navigation exactly once (no duplicate landmark for the drawer)', () => {
    renderShell();
    expect(screen.getAllByRole('navigation', { name: /views/i })).toHaveLength(1);
  });

  it('opens the drawer, sets aria-expanded, and moves focus into it', async () => {
    const user = userEvent.setup();
    renderShell();
    const toggle = screen.getByRole('button', { name: /open navigation menu/i });
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // Focus moves to the first focusable element of the drawer — its close button.
    expect(screen.getByRole('button', { name: /close navigation menu/i })).toHaveFocus();
  });

  it('closes the drawer via its close button and restores focus to the toggle', async () => {
    const user = userEvent.setup();
    renderShell();
    const toggle = screen.getByRole('button', { name: /open navigation menu/i });
    await user.click(toggle);

    await user.click(screen.getByRole('button', { name: /close navigation menu/i }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  it('closes the drawer when Escape is pressed', async () => {
    const user = userEvent.setup();
    renderShell();
    const toggle = screen.getByRole('button', { name: /open navigation menu/i });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  it('closes the drawer when the scrim is clicked', async () => {
    const user = userEvent.setup();
    renderShell();
    const toggle = screen.getByRole('button', { name: /open navigation menu/i });
    await user.click(toggle);

    await user.click(screen.getByRole('button', { name: /dismiss navigation menu/i }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the sidebar navigation reachable while the drawer is open', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: /open navigation menu/i }));

    const nav = screen.getByRole('navigation', { name: /views/i });
    expect(within(nav).getByRole('button', { name: /all notes/i })).toBeInTheDocument();
  });
});
