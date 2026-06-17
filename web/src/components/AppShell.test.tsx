import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from './AppShell';

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
});
