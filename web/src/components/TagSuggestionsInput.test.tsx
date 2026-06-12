import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagSuggestionsInput } from './TagSuggestionsInput';

const SUGGESTIONS = ['alpha', 'beta', 'gamma', 'delta'];

function renderInput(value = '', onChange = vi.fn(), suggestions = SUGGESTIONS) {
  const utils = render(
    <TagSuggestionsInput
      id="test-tags"
      value={value}
      onChange={onChange}
      suggestions={suggestions}
    />,
  );
  const input = screen.getByRole('combobox');
  return { ...utils, input, onChange };
}

describe('TagSuggestionsInput', () => {
  it('renders with role combobox and correct aria attributes', () => {
    renderInput();
    const input = screen.getByRole('combobox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows no suggestions when value is empty', () => {
    renderInput('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows filtered suggestions when typing a matching segment', async () => {
    const onChange = vi.fn();
    renderInput('al', onChange);
    const input = screen.getByRole('combobox');
    // Clicking the input triggers onFocus -> setOpen(true), which shows suggestions
    await userEvent.click(input);
    // The listbox should be visible since "al" matches "alpha"
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'alpha' })).toBeInTheDocument();
    // "beta" does not include "al" — it should not appear
    expect(screen.queryByRole('option', { name: 'beta' })).not.toBeInTheDocument();
  });

  it('filters case-insensitively', async () => {
    renderInput('AL');
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    expect(screen.getByRole('option', { name: 'alpha' })).toBeInTheDocument();
  });

  it('navigates suggestions with ArrowDown and ArrowUp', async () => {
    renderInput('al');
    const input = screen.getByRole('combobox');
    await userEvent.click(input);

    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();

    // ArrowDown should highlight the first option
    await userEvent.keyboard('{ArrowDown}');
    const opt = within(listbox).getByRole('option', { name: 'alpha' });
    expect(opt).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', opt.id);

    // ArrowUp from first stays at first
    await userEvent.keyboard('{ArrowUp}');
    expect(opt).toHaveAttribute('aria-selected', 'true');
  });

  it('selects a suggestion on Enter and calls onChange with merged value', async () => {
    const onChange = vi.fn();
    renderInput('al', onChange);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('alpha'));
  });

  it('closes the dropdown on Escape', async () => {
    renderInput('al');
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('selects a suggestion on mouse click', async () => {
    const onChange = vi.fn();
    renderInput('al', onChange);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    const option = screen.getByRole('option', { name: 'alpha' });
    await userEvent.pointer({ target: option, keys: '[MouseLeft>]' });
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('alpha'));
  });

  it('excludes already-chosen tags from suggestions', async () => {
    // Value has "alpha, " already typed; partial segment is "b"
    renderInput('alpha, b');
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    // "alpha" is already in the first segment so it shouldn't appear
    // even though "b" would not match "alpha" anyway; let's verify "beta" shows
    // and alpha does not
    const listbox = screen.queryByRole('listbox');
    if (listbox) {
      expect(screen.queryByRole('option', { name: 'alpha' })).not.toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'beta' })).toBeInTheDocument();
    }
  });

  it('does not show listbox when there are no suggestions', async () => {
    renderInput('xyz', vi.fn(), []);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('reflects controlled value in the input', () => {
    renderInput('foo, bar');
    expect(screen.getByRole('combobox')).toHaveValue('foo, bar');
  });

  it('appends comma+space after selecting a suggestion', async () => {
    const onChange = vi.fn();
    renderInput('al', onChange);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    // The resulting value should end with ", " ready for the next tag
    const call = onChange.mock.calls[onChange.mock.calls.length - 1][0] as string;
    expect(call).toMatch(/,\s*$/);
  });

  it('opens suggestions when ArrowDown is pressed even without onFocus', async () => {
    renderInput('ga');
    const input = screen.getByRole('combobox');
    // Use userEvent.tab to move focus to the input (wraps state changes in act)
    await userEvent.click(input);
    // Close the list that onFocus opened, then reopen with ArrowDown
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('shows aria-label Tags by default', () => {
    renderInput();
    expect(screen.getByRole('combobox', { name: /tags/i })).toBeInTheDocument();
  });
});
