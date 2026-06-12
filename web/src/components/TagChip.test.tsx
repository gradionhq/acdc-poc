import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TagChip } from './TagChip';

describe('TagChip', () => {
  it('renders the tag text', () => {
    render(<TagChip tag="work" />);
    expect(screen.getByText('work')).toBeInTheDocument();
  });

  it('exposes data-tag and defaults data-tag-color to "none"', () => {
    render(<TagChip tag="work" />);
    const chip = screen.getByText('work');
    expect(chip).toHaveAttribute('data-tag', 'work');
    expect(chip).toHaveAttribute('data-tag-color', 'none');
  });

  it('reflects an assigned color via data-tag-color and a color class', () => {
    render(<TagChip tag="urgent" color="red" />);
    const chip = screen.getByText('urgent');
    expect(chip).toHaveAttribute('data-tag-color', 'red');
    // The color variant class is applied (CSS-modules hashes it, so match prefix)
    expect(chip.className).toMatch(/chip-red/);
  });

  it('treats null color as the default style', () => {
    render(<TagChip tag="plain" color={null} />);
    const chip = screen.getByText('plain');
    expect(chip).toHaveAttribute('data-tag-color', 'none');
    expect(chip.className).not.toMatch(/chip-red/);
  });

  it('appends an extra className when provided', () => {
    render(<TagChip tag="x" className="extra-class" />);
    expect(screen.getByText('x').className).toMatch(/extra-class/);
  });
});
