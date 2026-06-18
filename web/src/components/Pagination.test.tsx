import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('renders the current page and total pages', () => {
    render(<Pagination page={2} totalPages={5} onPrev={() => {}} onNext={() => {}} />);
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
  });

  it('disables Previous on the first page', () => {
    render(<Pagination page={1} totalPages={5} onPrev={() => {}} onNext={() => {}} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
  });

  it('uses the server-supplied hasNext to disable Next', () => {
    render(
      <Pagination page={1} totalPages={5} hasNext={false} onPrev={() => {}} onNext={() => {}} />,
    );
    // Despite more pages existing per totalPages, hasNext=false wins.
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  it('enables Next when hasNext is true', () => {
    render(
      <Pagination page={5} totalPages={5} hasNext={true} onPrev={() => {}} onNext={() => {}} />,
    );
    // Despite being on the last page per totalPages, hasNext=true wins.
    expect(screen.getByRole('button', { name: /next page/i })).toBeEnabled();
  });

  it('falls back to totalPages comparison when hasNext is omitted', () => {
    render(<Pagination page={5} totalPages={5} onPrev={() => {}} onNext={() => {}} />);
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  it('invokes the navigation callbacks on click', async () => {
    const user = userEvent.setup();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(<Pagination page={2} totalPages={5} hasNext onPrev={onPrev} onNext={onNext} />);
    await user.click(screen.getByRole('button', { name: /previous page/i }));
    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(onPrev).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
  });
});
